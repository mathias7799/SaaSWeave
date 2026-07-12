import { createHmac } from "node:crypto";
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import { createServer as createTcpServer, type AddressInfo, type Socket } from "node:net";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { OUTBOUND_HTTP_LIMITS } from "@saasweave/core/security";

import {
  OutboundHttpError,
  assertPublicWebhookUrl,
  hardenedOutboundRequest,
  toSanitizedOutboundFailure,
  type DnsLookupResult,
  type PinnedRequestExecutor
} from "#@/outbound-http";
import { defaultRequestExecutor } from "#@/outbound-http/client";

type TestServer = {
  close: () => Promise<void>;
  port: number;
  requests: Array<{
    headers: Record<string, string | string[] | undefined>;
    method?: string;
    url?: string;
  }>;
};

function createTestServer(
  handler: (req: IncomingMessage, res: ServerResponse, ctx: TestServer) => void
): Promise<TestServer> {
  const ctx: TestServer = {
    close: async () => {},
    port: 0,
    requests: []
  };

  const server = createServer((req, res) => handler(req, res, ctx));

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      ctx.port = address.port;
      ctx.close = () =>
        new Promise((closeResolve, closeReject) => {
          server.close((error) => {
            if (error) closeReject(error);
            else closeResolve();
          });
        });
      resolve(ctx);
    });
    server.on("error", reject);
  });
}

function publicResolver(
  address = "93.184.216.34"
): (hostname: string) => Promise<DnsLookupResult[]> {
  return async () => [{ address, family: 4 }];
}

function localPinnedRequest(port: number): PinnedRequestExecutor {
  return (input) => {
    const path = `${input.parsed.url.pathname}${input.parsed.url.search}`;

    return new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          headers: input.headers,
          hostname: "127.0.0.1",
          method: input.method,
          path,
          port,
          timeout: input.connectTimeoutMs
        },
        resolve
      );
      req.on("error", reject);
      if (input.body) req.write(input.body);
      req.end();
    });
  };
}

const servers: TestServer[] = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await server.close();
  }
});

describe("assertPublicWebhookUrl", () => {
  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://192.168.1.10",
    "http://[::1]/",
    "ftp://8.8.8.8",
    "not-a-url"
  ])("rejects %s", async (url) => {
    await expect(assertPublicWebhookUrl(url)).rejects.toThrow(
      /invalid_webhook_url|blocked_webhook_url|dns_empty|connect_failed/
    );
  });

  it("accepts a public literal IP when DNS resolves publicly", async () => {
    await expect(
      assertPublicWebhookUrl("https://93.184.216.34/hook", {
        resolver: publicResolver()
      })
    ).resolves.toBeUndefined();
  });

  it("rejects DNS answers that include a private address", async () => {
    await expect(
      assertPublicWebhookUrl("https://example.test/hook", {
        resolver: async () => [
          { address: "8.8.8.8", family: 4 },
          { address: "10.0.0.1", family: 4 }
        ]
      })
    ).rejects.toThrow("blocked_webhook_url");
  });
});

describe("hardenedOutboundRequest", () => {
  it("rejects empty DNS answers and invalid URLs", async () => {
    await expect(
      hardenedOutboundRequest({
        deps: { resolver: async () => [] },
        method: "GET",
        url: "https://example.test/hook"
      })
    ).rejects.toMatchObject({ code: "network_error", message: "dns_empty" });
    await expect(
      hardenedOutboundRequest({ method: "GET", url: "not-a-url" })
    ).rejects.toMatchObject({ code: "invalid_webhook_url" });
  });

  it("normalizes exhausted address attempts to connect_failed", async () => {
    await expect(
      hardenedOutboundRequest({
        deps: {
          request: async () => {
            throw new Error("offline");
          },
          resolver: async () => [
            { address: "93.184.216.34", family: 4 },
            { address: "93.184.216.35", family: 4 }
          ]
        },
        method: "GET",
        url: "https://example.test/hook"
      })
    ).rejects.toMatchObject({ code: "network_error", message: "connect_failed" });
  });
  it.each([
    { address: "10.0.0.1", label: "private IPv4" },
    { address: "127.0.0.1", label: "loopback IPv4" },
    { address: "::1", label: "loopback IPv6" },
    { address: "::ffff:127.0.0.1", label: "mapped IPv6 loopback" }
  ])("blocks $label destinations", async ({ address }) => {
    await expect(
      hardenedOutboundRequest({
        deps: { resolver: async () => [{ address, family: address.includes(":") ? 6 : 4 }] },
        method: "POST",
        url: "http://example.test/hook"
      })
    ).rejects.toMatchObject({ code: "blocked_webhook_url" });
  });

  it("delivers a signed POST via pinned transport", async () => {
    const server = await createTestServer((req, res, ctx) => {
      ctx.requests.push({ headers: req.headers, method: req.method, url: req.url });
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk as Buffer));
      req.on("end", () => {
        res.statusCode = 200;
        res.end("ok");
      });
    });
    servers.push(server);

    const payload = {
      createdAt: "2026-01-01T00:00:00.000Z",
      data: { test: true },
      event: "usage.recorded",
      id: "wh_test",
      organizationId: "org_1"
    };
    const body = JSON.stringify(payload);
    const timestamp = 1_700_000_000;
    const secret = "whsec_test";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

    const response = await hardenedOutboundRequest({
      body,
      deps: {
        request: localPinnedRequest(server.port),
        resolver: publicResolver()
      },
      headers: {
        "Content-Type": "application/json",
        "X-SaaSWeave-Signature": `t=${timestamp},v1=${signature}`,
        "X-SaaSWeave-Event": payload.event
      },
      method: "POST",
      url: "http://example.test/hook"
    });

    expect(response.status).toBe(200);
    expect(response.body).toBe("ok");
    expect(server.requests[0]?.method).toBe("POST");
    expect(server.requests[0]?.headers["x-saasweave-signature"]).toBe(
      `t=${timestamp},v1=${signature}`
    );
    expect(createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")).toBe(
      signature
    );
  });

  it("rejects redirect-to-private targets after re-validation", async () => {
    let hop = 0;
    const server = await createTestServer((req, res) => {
      if (req.url === "/start") {
        res.statusCode = 302;
        res.setHeader("Location", "http://example.test/second");
        res.end();
        return;
      }
      res.statusCode = 200;
      res.end("ok");
    });
    servers.push(server);

    await expect(
      hardenedOutboundRequest({
        deps: {
          request: localPinnedRequest(server.port),
          resolver: async () => {
            hop += 1;
            if (hop === 1) {
              return [{ address: "93.184.216.34", family: 4 }];
            }
            return [{ address: "10.0.0.1", family: 4 }];
          }
        },
        method: "POST",
        url: "http://example.test/start"
      })
    ).rejects.toMatchObject({ code: "blocked_webhook_url" });
  });

  it("rejects redirect loops after the configured maximum", async () => {
    const server = await createTestServer((req, res) => {
      res.statusCode = 302;
      res.setHeader("Location", req.url === "/one" ? "/two" : "/one");
      res.end();
    });
    servers.push(server);

    await expect(
      hardenedOutboundRequest({
        deps: {
          request: localPinnedRequest(server.port),
          resolver: publicResolver()
        },
        maxRedirects: OUTBOUND_HTTP_LIMITS.MAX_REDIRECTS,
        method: "POST",
        url: "http://example.test/one"
      })
    ).rejects.toMatchObject({ code: "redirect_loop" });
  });

  it("rejects redirects without a Location header", async () => {
    const server = await createTestServer((_req, res) => {
      res.statusCode = 302;
      res.end();
    });
    servers.push(server);

    await expect(
      hardenedOutboundRequest({
        deps: { request: localPinnedRequest(server.port), resolver: publicResolver() },
        method: "GET",
        url: "http://example.test/start"
      })
    ).rejects.toMatchObject({ code: "network_error", message: "redirect_missing_location" });
  });

  it("converts POST to GET on 303 and removes configured sensitive headers", async () => {
    const server = await createTestServer((req, res, ctx) => {
      ctx.requests.push({ headers: req.headers, method: req.method, url: req.url });
      if (req.url === "/start") {
        res.statusCode = 303;
        res.setHeader("Location", "/done");
      } else {
        res.statusCode = 200;
      }
      res.end("ok");
    });
    servers.push(server);

    await hardenedOutboundRequest({
      body: "payload",
      deps: { request: localPinnedRequest(server.port), resolver: publicResolver() },
      headers: { "X-Webhook-Secret": "secret" },
      method: "POST",
      sensitiveHeaders: ["x-webhook-secret"],
      url: "http://example.test/start"
    });

    expect(server.requests[1]?.method).toBe("GET");
    expect(server.requests[1]?.headers["x-webhook-secret"]).toBeUndefined();
  });

  it("rejects cross-origin redirects without forwarding signatures", async () => {
    const server = await createTestServer((_req, res) => {
      res.statusCode = 302;
      res.setHeader("Location", "http://other.test/elsewhere");
      res.end();
    });
    servers.push(server);

    await expect(
      hardenedOutboundRequest({
        deps: {
          request: localPinnedRequest(server.port),
          resolver: publicResolver()
        },
        headers: { "X-SaaSWeave-Signature": "t=1,v1=abc" },
        method: "POST",
        sensitiveHeaders: ["x-saasweave-signature"],
        url: "http://example.test/start"
      })
    ).rejects.toMatchObject({ code: "redirect_to_different_origin" });
  });

  it("uses one DNS resolution per hop so rebinding cannot swap answers mid-connect", async () => {
    let lookupCount = 0;
    const server = await createTestServer((_req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });
    servers.push(server);

    await hardenedOutboundRequest({
      deps: {
        request: localPinnedRequest(server.port),
        resolver: async () => {
          lookupCount += 1;
          return [{ address: "93.184.216.34", family: 4 }];
        }
      },
      method: "GET",
      url: "http://example.test/hook"
    });

    expect(lookupCount).toBe(1);
  });

  it("times out when the outbound request exceeds its abort budget", async () => {
    await expect(
      hardenedOutboundRequest({
        deps: {
          request: (input) =>
            new Promise((_, reject) => {
              input.signal?.addEventListener(
                "abort",
                () => {
                  reject(new OutboundHttpError("timeout", "aborted"));
                },
                { once: true }
              );
            }),
          resolver: publicResolver()
        },
        method: "GET",
        signal: AbortSignal.timeout(50),
        url: "http://example.test/slow"
      })
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("streams and truncates oversized chunked responses", async () => {
    const server = await createTestServer((_req, res) => {
      res.statusCode = 200;
      res.setHeader("Transfer-Encoding", "chunked");
      res.write("a".repeat(1_500));
      res.write("b".repeat(1_500));
      res.end();
    });
    servers.push(server);

    const response = await hardenedOutboundRequest({
      deps: {
        request: localPinnedRequest(server.port),
        resolver: publicResolver()
      },
      method: "GET",
      url: "http://example.test/big"
    });

    expect(response.body.length).toBe(OUTBOUND_HTTP_LIMITS.MAX_RESPONSE_BODY_BYTES);
    expect(response.truncated).toBe(true);
  });

  it("stops reading when another chunk arrives after the exact response limit", async () => {
    const server = await createTestServer((_req, res) => {
      res.write("a".repeat(OUTBOUND_HTTP_LIMITS.MAX_RESPONSE_BODY_BYTES));
      setTimeout(() => {
        res.write("b");
        res.end();
      }, 10);
    });
    servers.push(server);

    const response = await hardenedOutboundRequest({
      deps: { request: localPinnedRequest(server.port), resolver: publicResolver() },
      method: "GET",
      url: "http://example.test/exact-then-more"
    });

    expect(response.body).toHaveLength(OUTBOUND_HTTP_LIMITS.MAX_RESPONSE_BODY_BYTES);
    expect(response.truncated).toBe(true);
  });

  it("rejects oversized request payloads before connecting", async () => {
    await expect(
      hardenedOutboundRequest({
        body: "x".repeat(OUTBOUND_HTTP_LIMITS.MAX_REQUEST_BODY_BYTES + 1),
        method: "POST",
        url: "http://example.test/hook"
      })
    ).rejects.toMatchObject({ code: "payload_too_large" });
  });
});

describe("toSanitizedOutboundFailure", () => {
  it("redacts internal addresses and secrets from stored failures", () => {
    const failure = toSanitizedOutboundFailure(
      new OutboundHttpError("network_error", "connect ECONNREFUSED 10.0.0.1:443 whsec_live_secret")
    );
    expect(failure.code).toBe("network_error");
    expect(failure.message).not.toContain("10.0.0.1");
    expect(failure.message).not.toContain("whsec_live_secret");
    expect(failure.message).toContain("[redacted-ip]");
    expect(failure.message).toContain("[redacted-secret]");
  });

  it.each([
    "connect ECONNREFUSED ::1:65500",
    "connect EHOSTUNREACH 2001:db8::1:443",
    "connect ECONNREFUSED [fd00::1234]:8443",
    "connect ENETUNREACH ::ffff:10.0.0.1:443"
  ])("redacts IPv6 from Node failure text: %s", (message) => {
    const failure = toSanitizedOutboundFailure(new Error(message));

    expect(failure.message).not.toContain("::");
    expect(failure.message).toContain("[redacted-ip]");
  });

  it("normalizes abort and non-Error failures", () => {
    const abortError = new Error("request aborted");
    abortError.name = "AbortError";
    expect(toSanitizedOutboundFailure(abortError)).toEqual({ code: "timeout", message: "timeout" });
    expect(toSanitizedOutboundFailure("offline")).toEqual({
      code: "network_error",
      message: "network_error"
    });
  });
});

describe("defaultRequestExecutor", () => {
  it("writes request bodies to the pinned HTTP destination", async () => {
    let received = "";
    const server = await createTestServer((req, res) => {
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        received += chunk;
      });
      req.on("end", () => {
        res.end("ok");
      });
    });
    servers.push(server);
    const url = new URL("http://example.test/hook");
    const response = await defaultRequestExecutor({
      body: "payload",
      connectTimeoutMs: 500,
      headers: {},
      headersTimeoutMs: 500,
      method: "POST",
      parsed: {
        hostname: url.hostname,
        origin: url.origin,
        port: server.port,
        protocol: "http:",
        url
      },
      pinned: { address: "127.0.0.1", family: 4 }
    });
    response.resume();
    expect(received).toBe("payload");
  });

  it("times out while waiting for response headers", async () => {
    const server = await createTestServer(() => {
      // Keep the connected request open without sending headers.
    });
    servers.push(server);
    const url = new URL("http://example.test/hook");
    await expect(
      defaultRequestExecutor({
        connectTimeoutMs: 500,
        headers: {},
        headersTimeoutMs: 25,
        method: "GET",
        parsed: {
          hostname: url.hostname,
          origin: url.origin,
          port: server.port,
          protocol: "http:",
          url
        },
        pinned: { address: "127.0.0.1", family: 4 }
      })
    ).rejects.toMatchObject({ code: "timeout", message: "headers_timeout" });
  });
  it("clears the connect timer once TCP connects while waiting for response headers", async () => {
    const server = await createTestServer((_req, res) => {
      setTimeout(() => {
        res.statusCode = 200;
        res.end("ok");
      }, 75);
    });
    servers.push(server);
    const url = new URL("http://example.test/hook");

    const response = await defaultRequestExecutor({
      connectTimeoutMs: 25,
      headers: {},
      headersTimeoutMs: 500,
      method: "GET",
      parsed: {
        hostname: url.hostname,
        origin: url.origin,
        port: server.port,
        protocol: "http:",
        url
      },
      pinned: { address: "127.0.0.1", family: 4 }
    });

    expect(response.statusCode).toBe(200);
    response.resume();
  });

  it("destroys a connection that does not complete its TLS handshake within the connect budget", async () => {
    const sockets = new Set<Socket>();
    const server = createTcpServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve);
      server.once("error", reject);
    });

    try {
      const address = server.address() as AddressInfo;
      const parsed = new URL("https://example.test/hook");

      await expect(
        defaultRequestExecutor({
          connectTimeoutMs: 50,
          headers: {},
          headersTimeoutMs: 1_000,
          method: "GET",
          parsed: {
            hostname: parsed.hostname,
            origin: parsed.origin,
            port: address.port,
            protocol: "https:",
            url: parsed
          },
          pinned: { address: "127.0.0.1", family: 4 }
        })
      ).rejects.toMatchObject({ code: "timeout", message: "connect_timeout" });
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
