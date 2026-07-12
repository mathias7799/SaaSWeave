# @saasweave/mailer

Transactional email rendering and delivery abstraction.

## Providers

| `MAIL_PROVIDER`     | Behavior                      |
| ------------------- | ----------------------------- |
| `console` (default) | Logs rendered email; no send  |
| `resend`            | Resend API (`RESEND_API_KEY`) |
| `smtp`              | Nodemailer (`SMTP_URL`)       |

## Templates

React Email templates in `src/templates/` (invitations, etc.). Rendered via `react-email`.

## Environment variables

| Variable         | Notes                            |
| ---------------- | -------------------------------- |
| `MAIL_PROVIDER`  | `console` \| `resend` \| `smtp`  |
| `MAIL_FROM`      | From header                      |
| `RESEND_API_KEY` | For resend                       |
| `SMTP_URL`       | e.g. `smtp://user:pass@host:587` |

## Related

- [packages/jobs](../jobs/README.md) — `dispatchTemplateEmail` queues sends
