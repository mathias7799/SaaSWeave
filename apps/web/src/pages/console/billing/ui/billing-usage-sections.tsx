import { CreditCard, Download, Lock } from "lucide-react";

import { Button } from "@saasweave/ui/components/button";

import { billingMessages, consoleCommonMessages } from "@/shared/lib/console-messages";
import { DonutChart } from "@/shared/ui/charts";
import {
  Badge,
  ConsoleEmptyState,
  formatCompact,
  formatCurrency,
  formatDate,
  formatNumber,
  LegendDot,
  Meter,
  Panel,
  PanelHeader
} from "@/shared/ui/console-kit";

import { type useGetBillingQuery } from "@/pages/console/billing/api/get-billing.query";

type BillingData = NonNullable<ReturnType<typeof useGetBillingQuery>["data"]>;

const CATEGORY_COLORS = ["var(--brand)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const INVOICE_TONE = { open: "warning", past_due: "destructive", paid: "success" } as const;

function meterLabels(unit: string, value: number): string {
  if (unit === "tokens") return consoleCommonMessages.meterTokens({ value: formatCompact(value) });
  if (unit === "gb") return consoleCommonMessages.meterGb({ value: formatNumber(value) });
  return formatCompact(value);
}

function invoiceStatusLabel(status: keyof typeof INVOICE_TONE): string {
  switch (status) {
    case "past_due":
      return consoleCommonMessages.statusPastDue();
    case "open":
      return consoleCommonMessages.statusOpen();
    case "paid":
      return consoleCommonMessages.statusPaid();
    default:
      return status;
  }
}

export function EstimateCard({ data }: { data: BillingData }) {
  return (
    <Panel>
      <PanelHeader
        title={billingMessages.estimateTitle()}
        description={billingMessages.estimateCycleRange({
          start: formatDate(data.plan.cycleStart),
          end: formatDate(data.plan.cycleEnd)
        })}
      />
      <div className="p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-4xl font-semibold tracking-tight text-foreground tabular-nums">
              {formatCurrency(data.estimate.total, true)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {billingMessages.billedOn({ date: formatDate(data.plan.renewsOn) })}
            </p>
          </div>
          <Badge tone="brand">{billingMessages.planBadge({ name: data.plan.name })}</Badge>
        </div>
        <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{billingMessages.platformBase()}</dt>
            <dd className="text-foreground tabular-nums">
              {formatCurrency(data.estimate.base, true)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              {billingMessages.seatsLine({
                count: data.estimate.seats,
                unitPrice: formatCurrency(data.estimate.seatUnitPrice, true)
              })}
            </dt>
            <dd className="text-foreground tabular-nums">
              {formatCurrency(data.estimate.seats * data.estimate.seatUnitPrice, true)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{billingMessages.usageOverage()}</dt>
            <dd className="text-foreground tabular-nums">
              {formatCurrency(data.estimate.usageOverage, true)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold">
            <dt>{billingMessages.estimatedTotal()}</dt>
            <dd className="tabular-nums">{formatCurrency(data.estimate.total, true)}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}

export function PaymentMethodCard({ data, onManage }: { data: BillingData; onManage: () => void }) {
  const paymentMethod = data.paymentMethod;

  return (
    <Panel className="flex flex-col">
      <PanelHeader title={billingMessages.paymentMethodTitle()} />
      <div className="flex flex-1 flex-col justify-between gap-5 p-5">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-foreground text-background">
            <CreditCard className="size-4" aria-hidden="true" />
          </span>
          <div className="text-sm">
            {paymentMethod ? (
              <>
                <p className="font-medium text-foreground">
                  {billingMessages.cardEnding({
                    brand: paymentMethod.brand,
                    last4: paymentMethod.last4
                  })}
                </p>
                <p className="text-muted-foreground">
                  {billingMessages.cardExpires({
                    month: String(paymentMethod.expMonth).padStart(2, "0"),
                    year: paymentMethod.expYear
                  })}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">{billingMessages.noPaymentMethod()}</p>
                <p className="text-muted-foreground">{billingMessages.addPaymentHint()}</p>
              </>
            )}
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={onManage}>
          {paymentMethod
            ? billingMessages.updatePaymentMethod()
            : billingMessages.openBillingPortal()}
        </Button>
      </div>
    </Panel>
  );
}

export function MeteredUsage({ data }: { data: BillingData }) {
  const donutSlices = data.costByCategory.map((entry, index) => {
    return {
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      key: entry.category,
      label: entry.category,
      value: entry.amount
    };
  });
  const categoryTotal = data.costByCategory.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel className="lg:col-span-2">
        <PanelHeader
          title={billingMessages.meteredUsageTitle()}
          description={billingMessages.meteredUsageDescription()}
          action={
            data.meteredLive ? <Badge tone="success">{billingMessages.liveUsage()}</Badge> : null
          }
        />
        <div className="space-y-6 p-5">
          {data.meters.map((meter) => {
            const over = meter.used - meter.included;
            return (
              <Meter
                key={meter.key}
                label={meter.label}
                fraction={meter.used / meter.included}
                usedLabel={meterLabels(meter.unit, meter.used)}
                includedLabel={meterLabels(meter.unit, meter.included)}
                note={
                  over > 0
                    ? billingMessages.overageNote({
                        amount: meterLabels(meter.unit, over),
                        cost: formatCurrency(over * meter.overageRate, true)
                      })
                    : undefined
                }
              />
            );
          })}
        </div>
      </Panel>

      <Panel className="flex flex-col">
        <PanelHeader title={billingMessages.costBreakdownTitle()} />
        <div className="flex flex-1 flex-col items-center gap-5 p-5">
          <DonutChart
            slices={donutSlices}
            centerValue={formatCurrency(categoryTotal)}
            centerLabel={billingMessages.thisCycle()}
          />
          <ul className="w-full space-y-2">
            {data.costByCategory.map((entry, index) => (
              <li key={entry.category} className="flex items-center justify-between gap-3 text-sm">
                <LegendDot
                  color={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                  label={entry.category}
                />
                <span className="text-muted-foreground tabular-nums">
                  {formatCurrency(entry.amount, true)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </div>
  );
}

export function InvoicingTeaser() {
  return (
    <Panel className="flex items-center justify-between gap-4 p-5 opacity-80">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {billingMessages.invoicingTitle()}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {billingMessages.invoicingDescription()}
        </p>
      </div>
      <Badge tone="neutral">Planned</Badge>
    </Panel>
  );
}

export function InvoicesCard({ data }: { data: BillingData }) {
  return (
    <Panel>
      <PanelHeader
        title={billingMessages.invoicesTitle()}
        description={billingMessages.invoicesDescription()}
      />
      {data.invoices.length === 0 ? (
        <ConsoleEmptyState
          description={billingMessages.emptyInvoicesDescription()}
          title={billingMessages.emptyInvoicesTitle()}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-5 py-3 font-medium">{consoleCommonMessages.invoice()}</th>
                <th className="px-5 py-3 font-medium">{consoleCommonMessages.date()}</th>
                <th className="px-5 py-3 font-medium">{consoleCommonMessages.status()}</th>
                <th className="px-5 py-3 text-right font-medium">
                  {consoleCommonMessages.amount()}
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  <span className="sr-only">{consoleCommonMessages.downloadSr()}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.invoices.map((invoice) => (
                <tr key={invoice.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3 font-medium text-foreground">{invoice.number}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatDate(invoice.issuedOn)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={INVOICE_TONE[invoice.status]}>
                      {invoiceStatusLabel(invoice.status)}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right text-foreground tabular-nums">
                    {formatCurrency(invoice.amount, true)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={billingMessages.downloadInvoiceAria({ number: invoice.number })}
                    >
                      <Download />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
