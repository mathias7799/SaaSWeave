# @saasweave/i18n

Paraglide.js compiled internationalization: message catalogs, locale middleware, and codegen.

## Platform usage

| Area                   | Status                                          |
| ---------------------- | ----------------------------------------------- |
| Marketing / auth pages | English messages in `messages/en.json`          |
| Console (`/app/*`)     | Full i18n via `console-messages.ts` (~320 keys) |
| Locale routing         | `/{-$locale}` optional prefix                   |

## Always on

- Compiled `m.*` message functions (no runtime JSON)
- Server middleware integration for TanStack Start
- Locale routing via optional `/{-$locale}` prefix (`src/__tests__/routing.test.ts`)

## Scripts

```bash
vp test         # routing/locale contract tests
pnpm build      # Paraglide compile (required before web/server build)
```

## Optional

Additional locale files under `messages/` — add locale + Paraglide config to enable.

## Environment variables

None in this package; web uses `VITE_WEB_URL` for locale URL generation.

---

## Usage

### TanStack Start

We have to create a `src/server.ts` file with the following content:

```ts
import { paraglideMiddleware } from "@saasweave/i18n/server";
import handler from "@tanstack/react-start/server-entry";

export default {
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, () => handler.fetch(req));
  }
};
```

This will ensure that the i18n middleware is properly integrated into the server-side rendering process of TanStack Start.
