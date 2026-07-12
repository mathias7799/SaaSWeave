import { Check } from "lucide-react";
import { useState } from "react";

import { m } from "@saasweave/i18n/messages";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { Button } from "@saasweave/ui/components/button";
import { DecorIcon } from "@saasweave/ui/components/decor-icon";
import { Skeleton } from "@saasweave/ui/components/skeleton";
import { cn } from "@saasweave/ui/lib/utils";

import { useGetPlansQuery } from "@/shared/api/get-plans.query";

import { platformConfig } from "@/config/platform.config";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: platformConfig.currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function PricingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton className="h-96 rounded-xl" key={index} />
      ))}
    </div>
  );
}

const FAQS = [
  { answer: m.pricing_page__faq_a1, question: m.pricing_page__faq_q1 },
  { answer: m.pricing_page__faq_a2, question: m.pricing_page__faq_q2 },
  { answer: m.pricing_page__faq_a3, question: m.pricing_page__faq_q3 }
];

export function PricingPage() {
  const query = useGetPlansQuery();
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-sm font-medium tracking-wide text-brand uppercase">
          {m.pricing_page__eyebrow()}
        </p>
        <h1 className="font-display text-4xl font-medium -tracking-[0.01em] text-balance text-foreground sm:text-5xl">
          {m.pricing_page__title()}
        </h1>
        <p className="mt-4 text-balance text-muted-foreground">{m.pricing_page__description()}</p>
      </div>

      <div className="mt-10 flex justify-center">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted p-1">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                interval === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              key={value}
              onClick={() => setInterval(value)}
              type="button"
            >
              {value === "monthly"
                ? m.pricing_page__billing_monthly()
                : m.pricing_page__billing_annual()}
              {value === "annual" ? (
                <span className="ml-1.5 text-xs text-brand">
                  {m.pricing_page__annual_discount({ months: platformConfig.annualMonthsFree })}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10">
        {!query.data ? (
          <PricingSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {query.data.map((plan) => {
              const monthly =
                plan.priceMonthly === null
                  ? null
                  : interval === "annual"
                    ? Math.round((plan.priceMonthly * (12 - platformConfig.annualMonthsFree)) / 12)
                    : plan.priceMonthly;
              return (
                <div
                  className={cn(
                    "relative flex flex-col rounded-xl border p-6",
                    plan.popular
                      ? "border-brand-border ring-1 ring-brand-border/50"
                      : "border-border"
                  )}
                  key={plan.id}
                >
                  {plan.popular ? (
                    <span className="absolute -top-3 left-6 rounded-full border border-brand-border/60 bg-brand-subtle/50 px-2.5 py-0.5 text-xs font-medium text-brand">
                      {m.pricing_page__popular_badge()}
                    </span>
                  ) : null}
                  <h3 className="font-display text-xl font-medium text-foreground">{plan.name}</h3>
                  <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-medium tracking-tight text-foreground tabular-nums">
                      {monthly === null ? m.pricing_page__custom_price() : formatPrice(monthly)}
                    </span>
                    {monthly !== null ? (
                      <span className="text-sm text-muted-foreground">
                        {m.pricing_page__per_month()}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {m.pricing_page__seats_included({ count: plan.seatsIncluded })}
                    {plan.seatPrice ? (
                      <> · {m.pricing_page__seat_addon({ price: plan.seatPrice })}</>
                    ) : null}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.highlights.map((highlight) => (
                      <li
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                        key={highlight}
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="mt-6 w-full"
                    light={plan.popular ? "skeuomorphic" : "none"}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    <Link to="/create-an-account">{plan.cta}</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mx-auto mt-24 max-w-2xl">
        <h2 className="font-display text-center text-2xl font-medium text-foreground">
          {m.pricing_page__faq_heading()}
        </h2>
        <dl className="mt-8 space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.question()}>
              <dt className="font-medium text-foreground">{faq.question()}</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">{faq.answer()}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="mt-24 overflow-x-clip p-4">
        <div className="relative container mx-auto flex flex-col items-center gap-4 border-y px-4 py-8 lg:max-w-3xl">
          <DecorIcon className="size-4" position="top-left" />
          <DecorIcon className="size-4" position="top-right" />
          <DecorIcon className="size-4" position="bottom-left" />
          <DecorIcon className="size-4" position="bottom-right" />
          <h2 className="font-display text-center text-3xl sm:text-4xl">
            {m.pricing_page__cta_title()}
          </h2>
          <p className="text-center text-sm text-balance text-muted-foreground md:text-base">
            {m.pricing_page__cta_description()}
          </p>
          <Button asChild light="skeuomorphic">
            <Link to="/create-an-account">{m.home_page__cta_github()}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
