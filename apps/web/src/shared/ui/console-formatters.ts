const numberFmt = new Intl.NumberFormat("en-US");
const currencyFmt = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency"
});
const currencyCentsFmt = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, notation: "compact" }).format(
    value
  );
}

export function formatCurrency(value: number, cents = false): string {
  return (cents ? currencyCentsFmt : currencyFmt).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/** Format a metric value by its unit, for KPI tiles across the console + admin. */
export function formatMetricValue(
  value: number,
  unit: "count" | "currency" | "tokens" | "ms" | "percent"
): string {
  switch (unit) {
    case "currency":
      return formatCurrency(value);
    case "tokens":
      return formatCompact(value);
    case "ms":
      return `${formatNumber(value)}ms`;
    case "percent":
      return `${formatNumber(value)}%`;
    case "count":
      return value >= 100000 ? formatCompact(value) : formatNumber(value);
    default:
      return formatNumber(value);
  }
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
