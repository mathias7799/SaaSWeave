import { type IncomingMessage } from "node:http";

import { type OutboundUrlErrorCode } from "@saasweave/core/security";
import { type ParsedOutboundUrl } from "@saasweave/core/security";

export type DnsLookupResult = {
  address: string;
  family: 4 | 6;
};

export type DnsResolver = (hostname: string) => Promise<DnsLookupResult[]>;

export type PinnedRequestExecutor = (input: {
  body?: string;
  connectTimeoutMs: number;
  headers: Record<string, string>;
  headersTimeoutMs: number;
  method: string;
  parsed: ParsedOutboundUrl;
  pinned: DnsLookupResult;
  signal?: AbortSignal;
}) => Promise<IncomingMessage>;

export type OutboundHttpDeps = {
  request?: PinnedRequestExecutor;
  resolver?: DnsResolver;
};

export type OutboundHttpFailureCode =
  | OutboundUrlErrorCode
  | "network_error"
  | "payload_too_large"
  | "redirect_loop"
  | "redirect_to_different_origin"
  | "timeout";

export class OutboundHttpError extends Error {
  readonly code: OutboundHttpFailureCode;

  constructor(code: OutboundHttpFailureCode, message?: string) {
    super(message ?? code);
    this.name = "OutboundHttpError";
    this.code = code;
  }
}

export type HardenedOutboundRequestInput = {
  body?: string;
  deps?: OutboundHttpDeps;
  followRedirects?: boolean;
  headers?: Record<string, string>;
  maxRedirects?: number;
  method: string;
  sensitiveHeaders?: string[];
  signal?: AbortSignal;
  url: string;
};

export type HardenedOutboundResponse = {
  body: string;
  headers: Record<string, string>;
  status: number;
  truncated: boolean;
};
