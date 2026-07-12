import { Cloud, Gauge, ShieldCheck } from "lucide-react";

import { m } from "@saasweave/i18n/messages";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { Button } from "@saasweave/ui/components/button";
import { DecorIcon } from "@saasweave/ui/components/decor-icon";

const VALUES = [
  {
    Icon: Gauge,
    description:
      "Every number in the console is backed by real data — usage events, plan assignments, and audit entries, not sample fixtures.",
    title: "Real by default"
  },
  {
    Icon: ShieldCheck,
    description:
      "Multi-tenant from day one: organizations, roles, and platform-admin access are enforced at the data layer, not just the UI.",
    title: "Built for teams"
  },
  {
    Icon: Cloud,
    description:
      "Runs on your stack — deploy to any major cloud or JavaScript runtime, self-host with Docker, or use the hosted console.",
    title: "Yours to run"
  }
];

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:py-28">
      <div className="text-center">
        <p className="mb-3 text-sm font-medium tracking-wide text-brand uppercase">About</p>
        <h1 className="font-display text-4xl font-medium -tracking-[0.01em] text-balance text-foreground sm:text-5xl">
          The operations console for AI-native teams
        </h1>
        <p className="mt-4 text-balance text-muted-foreground">
          SaaSWeave started as a simple question: what would it take to track product usage, meter
          every AI request, and bill for it, without stitching together five different tools? This
          console is the answer — one workspace for usage, billing, and the platform controls that
          keep it running.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {VALUES.map(({ Icon, title, description }) => (
          <div className="rounded-xl border border-border p-6" key={title}>
            <span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-brand-subtle/50 text-brand">
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <h3 className="font-display text-lg font-medium text-foreground">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>

      <section className="mt-24 overflow-x-clip p-4">
        <div className="relative container mx-auto flex flex-col items-center gap-4 border-y px-4 py-8 lg:max-w-2xl">
          <DecorIcon className="size-4" position="top-left" />
          <DecorIcon className="size-4" position="top-right" />
          <DecorIcon className="size-4" position="bottom-left" />
          <DecorIcon className="size-4" position="bottom-right" />
          <h2 className="font-display text-center text-3xl sm:text-4xl">
            {m.home_page__cta_title()}
          </h2>
          <p className="text-center text-sm text-balance text-muted-foreground md:text-base">
            {m.home_page__cta_description()}
          </p>
          <Button asChild light="skeuomorphic">
            <Link to="/create-an-account">{m.home_page__cta_github()}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
