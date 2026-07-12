import {
  ArrowDownRight,
  ArrowUpRight,
  type LucideIcon,
  RotateCcw,
  TriangleAlert
} from "lucide-react";
import type React from "react";

import { Button } from "@saasweave/ui/components/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@saasweave/ui/components/empty";
import { Skeleton } from "@saasweave/ui/components/skeleton";
import { cn } from "@saasweave/ui/lib/utils";

import { Sparkline } from "@/shared/ui/charts";
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatMetricValue,
  formatNumber,
  formatPercent,
  formatRelativeTime
} from "@/shared/ui/console-formatters";

export {
  formatCompact,
  formatCurrency,
  formatDate,
  formatMetricValue,
  formatNumber,
  formatPercent,
  formatRelativeTime
};

/**
 * Console UI kit — the small set of surfaces, tiles, and meters the SaaSWeave
 * console is composed from. Surfaces are bordered panels used only where
 * grouping earns it; never nest one panel inside another.
 */

// #region Panel

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4",
        className
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// #region SectionHeading

export function SectionHeading({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium tracking-wide text-brand uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// #region Badge

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "destructive" | "info";

const badgeTones: Record<BadgeTone, string> = {
  brand: "border-brand-border/60 bg-brand-subtle/50 text-brand",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
};

export function Badge({
  tone = "neutral",
  className,
  children
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// #region DeltaPill

export function DeltaPill({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = value >= 0;
  const good = invert ? !positive : positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// #region StatTile

export function StatTile({
  label,
  value,
  delta,
  spark,
  icon: Icon,
  invertDelta = false
}: {
  label: string;
  value: string;
  delta?: number;
  spark?: number[];
  icon?: LucideIcon;
  invertDelta?: boolean;
}) {
  return (
    <Panel className="flex flex-col justify-between p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
          {label}
        </span>
        {typeof delta === "number" ? <DeltaPill value={delta} invert={invertDelta} /> : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-display text-3xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </span>
        {spark && spark.length > 1 ? (
          <div className="w-24 shrink-0">
            <Sparkline values={spark} />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

// #region Meter

export function Meter({
  label,
  usedLabel,
  includedLabel,
  fraction,
  note
}: {
  label: string;
  usedLabel: string;
  includedLabel: string;
  fraction: number;
  note?: string;
}) {
  const pct = Math.min(100, Math.max(0, fraction * 100));
  const near = fraction > 0.8;
  // Over-allowance is an expected, billed state, not an error, so it reads amber
  // (heads-up) rather than destructive red.
  const barColor = near ? "bg-amber-500" : "bg-brand";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          <span className="text-foreground">{usedLabel}</span> / {includedLabel}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", barColor)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {note ? <p className="mt-1.5 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

// #region Skeleton

export function ConsoleSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

// #region ErrorState

/** Full-page failure state for a page whose primary query errored. Pairs with `ConsoleSkeleton`. */
export function ConsoleErrorState({
  title = "Couldn't load this page",
  description = "Something went wrong fetching this data.",
  onRetry
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
}) {
  return (
    <Empty>
      <EmptyMedia variant="icon">
        <TriangleAlert aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
      <Button onClick={onRetry} size="sm" variant="outline">
        <RotateCcw aria-hidden="true" className="size-4" />
        Retry
      </Button>
    </Empty>
  );
}

/** Inline empty-state for a panel/section with no data, e.g. an empty list or table. */
export function ConsoleEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Empty className="py-10">
      <EmptyTitle className="text-sm font-medium">{title}</EmptyTitle>
      {description ? <EmptyDescription className="text-sm">{description}</EmptyDescription> : null}
    </Empty>
  );
}

// #region Legend

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

// #region Switch

export function Switch({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand" : "bg-input"
      )}
    >
      <span
        className={cn(
          "inline-block size-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// #region Segmented

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
