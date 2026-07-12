import { Badge } from "@/shared/ui/console-kit";

type ChangelogTag = "new" | "improved" | "fixed";

type ChangelogEntry = {
  date: string;
  title: string;
  items: { tag: ChangelogTag; text: string }[];
};

const TAG_LABEL: Record<ChangelogTag, string> = {
  fixed: "Fixed",
  improved: "Improved",
  new: "New"
};

const TAG_TONE: Record<ChangelogTag, "brand" | "success" | "info"> = {
  fixed: "success",
  improved: "info",
  new: "brand"
};

const ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-07-07",
    items: [
      {
        tag: "new",
        text: "Workspace API keys — generate and revoke credentials for scripts and integrations."
      },
      { tag: "new", text: "Admin Users page — grant platform-admin access or ban accounts." },
      {
        tag: "new",
        text: "Forgot/reset password flow, account security page with session management."
      },
      { tag: "new", text: "Public pricing page and per-workspace audit log." },
      { tag: "new", text: "Admin workspace detail view with per-workspace feature overrides." }
    ],
    title: "Account, access, and self-serve pages"
  },
  {
    date: "2026-07-06",
    items: [
      {
        tag: "new",
        text: "Feature flags are now real: database-backed, staged rollouts, and per-workspace overrides."
      },
      {
        tag: "new",
        text: "Admin-editable plan catalog — create, edit, and retire plans without a deploy."
      },
      {
        tag: "new",
        text: "Platform settings (sign-ups, maintenance mode, trials) actually persist and take effect."
      },
      {
        tag: "improved",
        text: "Consistent error and empty states across the console and admin surfaces."
      }
    ],
    title: "Feature flags, plans, and platform settings"
  },
  {
    date: "2026-03-29",
    items: [
      { tag: "new", text: "Redis-backed cache and a BullMQ job runner for background work." },
      { tag: "improved", text: "General cleanup across the API and console packages." }
    ],
    title: "Caching and background jobs"
  },
  {
    date: "2026-03-15",
    items: [
      {
        tag: "new",
        text: "Functional workspace settings — rename or delete a workspace, with audit hooks."
      },
      { tag: "new", text: "Transactional email delivery log in the admin console." },
      { tag: "new", text: "Resend and SMTP email providers, with an admin template editor." },
      { tag: "new", text: "Immutable audit log across security- and billing-relevant actions." }
    ],
    title: "Workspace settings, email, and audit log"
  },
  {
    date: "2026-02-20",
    items: [
      {
        tag: "new",
        text: "Metered usage-based billing, backed by real usage events and Stripe meters."
      },
      {
        tag: "new",
        text: "Key-optional Stripe billing — subscriptions, the customer portal, and webhooks."
      },
      { tag: "new", text: "Real multi-tenant organizations, roles, and platform-admin gating." }
    ],
    title: "Multi-tenancy and billing"
  },
  {
    date: "2026-01-10",
    items: [
      {
        tag: "new",
        text: "First release: the SaaSWeave console with AI usage analytics and billing."
      }
    ],
    title: "Initial release"
  }
];

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

export function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:py-28">
      <div className="text-center">
        <p className="mb-3 text-sm font-medium tracking-wide text-brand uppercase">Changelog</p>
        <h1 className="font-display text-4xl font-medium -tracking-[0.01em] text-balance text-foreground sm:text-5xl">
          What's new
        </h1>
        <p className="mt-4 text-balance text-muted-foreground">
          Everything shipped to the platform, newest first.
        </p>
      </div>

      <ol className="mt-16 space-y-14 border-l border-border pl-8">
        {ENTRIES.map((entry) => (
          <li className="relative" key={entry.date}>
            <span className="absolute top-1.5 -left-[calc(2rem+3px)] size-2 rounded-full bg-brand" />
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {formatEntryDate(entry.date)}
            </p>
            <h2 className="font-display mt-1 text-xl font-medium text-foreground">{entry.title}</h2>
            <ul className="mt-3 space-y-2.5">
              {entry.items.map((item) => (
                <li
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                  key={item.text}
                >
                  <Badge className="mt-0.5 shrink-0" tone={TAG_TONE[item.tag]}>
                    {TAG_LABEL[item.tag]}
                  </Badge>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
