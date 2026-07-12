import { ArrowUpRight } from "lucide-react";
import type React from "react";

import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { type LinkProps } from "@saasweave/i18n/tanstack-start/components/link";

import { formatNumber, Meter } from "@/shared/ui/console-kit";
import { LogoWordmark } from "@/shared/ui/logo";

import { useGetSidebarOverviewQuery } from "@/features/console-nav/api/get-overview.query";
import { type ConsoleNavGroup } from "@/features/console-nav/config/console-nav.config";
import { ConsoleNavList } from "@/features/console-nav/ui/console-nav-list";

export function SidebarPlanCard() {
  const query = useGetSidebarOverviewQuery();
  const plan = query.data?.plan;

  return (
    <Link
      to="/app/billing"
      className="block rounded-xl border border-border bg-background p-4 transition-colors hover:border-brand-border/70"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {plan ? `${plan.name} plan` : "Plan"}
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      {plan ? (
        <div className="mt-2">
          <Meter
            fraction={plan.seatsIncluded > 0 ? plan.seatsUsed / plan.seatsIncluded : 0}
            includedLabel={`${formatNumber(plan.seatsIncluded)} seats`}
            label="Usage"
            usedLabel={formatNumber(plan.seatsUsed)}
          />
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Manage plan and usage-based billing.</p>
      )}
    </Link>
  );
}

export function ConsoleSidebar({
  groups,
  homeTo,
  ariaLabel,
  footer,
  topSlot
}: {
  groups: ConsoleNavGroup[];
  homeTo: LinkProps["to"];
  ariaLabel: string;
  footer?: React.ReactNode;
  topSlot?: React.ReactNode;
}) {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link to={homeTo} className="-m-2 rounded-md p-2 hover:bg-secondary/60">
          <LogoWordmark className="text-base" />
        </Link>
      </div>
      {topSlot ? <div className="px-3 pb-2">{topSlot}</div> : null}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ConsoleNavList groups={groups} ariaLabel={ariaLabel} />
      </div>
      {footer ? <div className="p-3">{footer}</div> : null}
    </aside>
  );
}
