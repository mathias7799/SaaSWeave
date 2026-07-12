# Browser log ingestion auth model

`POST /_logs/ingest` accepts batched browser telemetry from the web app.

## Model: anonymous same-origin ingestion with optional session enrichment

- **Not token-authenticated.** Browser logs use `credentials: "include"` so session cookies are sent when present, but ingestion does not require a signed-in user.
- **Not a secret endpoint.** CORS allows only `VITE_WEB_URL`; that limits which browsers may POST, but CORS is not authentication.
- **Rate limited by trusted client IP** (`resolveClientIp` with `TRUST_PROXY_HEADERS` when behind a trusted proxy).
- **Redis failure policy:** `resolveSecurityFailureMode()` returns `failClosed` when `REDIS_URL` is configured in production; otherwise `failOpen` with per-process memory limits.

## Server-owned fields

The server strips client-supplied values for correlation and identity fields, then attaches authoritative values:

| Field                                 | Source                                         |
| ------------------------------------- | ---------------------------------------------- |
| `source`                              | Always `"client"`                              |
| `service` / `environment` / `version` | Server logger env                              |
| `requestId`                           | Request logger / `X-Request-Id` when available |
| `user`                                | Better Auth session when cookie resolves       |
| `clientIp`                            | Trusted client IP                              |
| `serverTimestamp`                     | Server clock at ingest                         |
| `clientTimestamp`                     | Client `timestamp` when provided               |

Clients may still send `method`, `path`, and `event` names; `request` metadata fills gaps only when the event omits those fields.

## Limits

| Limit           | Value                      |
| --------------- | -------------------------- |
| Request body    | 64 KiB                     |
| Batch size      | 25 events                  |
| Object depth    | 8                          |
| Keys per object | 64                         |
| Key length      | 128 chars                  |
| String length   | 4,096 chars                |
| Rate limit      | 120 requests / minute / IP |

Oversized bodies return **413**. Invalid JSON returns **400**. Rate limit returns **429**.
