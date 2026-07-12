# @saasweave/api

oRPC API layer: typed procedures, console/admin/platform routers, Stripe billing HTTP surface, storage HTTP adapters, and client boundaries.

## Router shape

```ts
appRouter = {
  admin, // platform operators
  console, // organization workspace
  health, // readiness probes
  platform, // public status, signups policy
  private // stub for future internal APIs
};
```

## Package boundaries

| Concern                                                  | Owner           |
| -------------------------------------------------------- | --------------- |
| oRPC routers, request context, HTTP auth                 | `packages/api`  |
| Stripe webhook DB application, exports, batch processing | `packages/app`  |
| BullMQ processors                                        | `packages/jobs` |
| Worker process lifecycle                                 | `apps/worker`   |

## Client exports

| Subpath                      | Runtime           | Use                                                     |
| ---------------------------- | ----------------- | ------------------------------------------------------- |
| `client/browser/orpc`        | Browser only      | HTTP `RPCLink` client                                   |
| `client/server/orpc`         | SSR / server only | In-process `createRouterClient`                         |
| `client/tanstack-start/orpc` | Isomorphic        | TanStack Start loaders + browser (dynamic import split) |

SSR loaders use the in-process server client; browser hydration uses HTTP. See [docs/PACKAGE-DEPENDENCY-GRAPH.md](../../docs/PACKAGE-DEPENDENCY-GRAPH.md).

## Key server exports

- `@saasweave/api/routers/index` — `appRouter`
- `@saasweave/api/lib/stripe` — checkout, portal, webhook verification
- `@saasweave/api/lib/stripe-dispatch` — enqueue / inline Stripe jobs
- `@saasweave/api/lib/storage` — re-exports `@saasweave/app/storage` for HTTP routes
- `@saasweave/api/lib/data-export/download` — authorized export download handler

## Outbound webhook policy

Tenant webhook endpoints may use HTTP port 80 or HTTPS port 443 only. This is an intentional SSRF
control that prevents the webhook worker from becoming a general-purpose port probe. Deploy webhook
receivers on a standard web port or place a reverse proxy in front of a nonstandard upstream port.

## Tests

```bash
pnpm --filter @saasweave/api test:unit
```

## Related

- [packages/app](../app/README.md) — application services
- [packages/jobs](../jobs/README.md) — async dispatch and processors
- [packages/db](../db/README.md) — persistence
