# @saasweave/ui

shadcn/ui-based component library shared across the web app.

## Includes

- Radix UI primitives (button, dialog, form fields, etc.)
- Tailwind v4 styling conventions
- Shared theme token wiring via `styles/theme-inline.css` (imported by web `theme.css`)

## Usage

```tsx
import { Button } from "@saasweave/ui/components/button";
```

## Scripts

```bash
vp run ui       # add components (from repo root alias)
vp run ui:web   # web-scoped UI CLI
vp test         # unit tests (cn/utils contracts)
```

## Environment variables

None.

## Related

- [apps/web](../../apps/web/README.md) — primary consumer
