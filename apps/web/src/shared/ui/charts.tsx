import { useId } from "react";

import { cn } from "@saasweave/ui/lib/utils";

/**
 * Dependency-free SVG chart kit for the SaaSWeave console.
 *
 * Charts use straight segments (no smoothing) so they never misrepresent the
 * underlying numbers, draw from the theme's duotone palette (`--chart-*`,
 * `--brand`), and scale fluidly via `viewBox`. Colour is never the only signal:
 * every chart carries an accessible label.
 */

// #region helpers

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

// #region Sparkline

export function Sparkline({
  values,
  className,
  color = "var(--brand)"
}: {
  values: number[];
  className?: string;
  color?: string;
}) {
  const width = 100;
  const height = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-7 w-full", className)}
      aria-hidden="true"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// #region Area / line chart

export type AreaSeries = { key: string; label: string; color: string; values: number[] };

export function AreaChart({
  labels,
  series,
  height = 240,
  formatValue = compact,
  ariaLabel
}: {
  labels: string[];
  series: AreaSeries[];
  height?: number;
  formatValue?: (value: number) => string;
  ariaLabel: string;
}) {
  const gradientId = useId();
  const width = 760;
  const padding = { top: 12, right: 16, bottom: 26, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const max = niceCeil(Math.max(1, ...series.flatMap((serie) => serie.values)));
  const count = labels.length;
  const x = (index: number) => padding.left + (index / Math.max(1, count - 1)) * plotW;
  const y = (value: number) => padding.top + plotH - (value / max) * plotH;

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((fraction) => max * fraction);
  const xTickIndexes = Array.from({ length: 5 }, (_, index) =>
    Math.round((index / 4) * (count - 1))
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <title>{ariaLabel}</title>
      <defs>
        {series.map((serie, index) => (
          <linearGradient key={serie.key} id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={serie.color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={serie.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(value)}
            y2={y(value)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={y(value)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            {formatValue(value)}
          </text>
        </g>
      ))}

      {series.map((serie, index) => {
        const line = serie.values.map((value, i) => `${x(i)},${y(value)}`).join(" ");
        const area = `${padding.left},${y(0)} ${line} ${x(count - 1)},${y(0)}`;
        return (
          <g key={serie.key}>
            <polygon points={area} fill={`url(#${gradientId}-${index})`} />
            <polyline
              points={line}
              fill="none"
              stroke={serie.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {xTickIndexes.map((index) => (
        <text
          key={index}
          x={x(index)}
          y={height - 6}
          textAnchor="middle"
          fontSize={11}
          fill="var(--muted-foreground)"
        >
          {labels[index]}
        </text>
      ))}
    </svg>
  );
}

// #region Stacked bar chart

export type BarSegment = { key: string; label: string; color: string };

export function StackedBarChart({
  labels,
  values,
  segments,
  height = 240,
  formatValue = compact,
  ariaLabel
}: {
  labels: string[];
  /** values[dataIndex][segmentIndex] */
  values: number[][];
  segments: BarSegment[];
  height?: number;
  formatValue?: (value: number) => string;
  ariaLabel: string;
}) {
  const width = 760;
  const padding = { top: 12, right: 16, bottom: 26, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const totals = values.map((row) => row.reduce((sum, value) => sum + value, 0));
  const max = niceCeil(Math.max(1, ...totals));
  const count = labels.length;
  const slot = plotW / count;
  const barWidth = Math.min(26, slot * 0.62);
  const y = (value: number) => padding.top + plotH - (value / max) * plotH;
  const gridValues = [0, 0.5, 1].map((fraction) => max * fraction);
  const xTickIndexes = Array.from({ length: 5 }, (_, index) =>
    Math.round((index / 4) * (count - 1))
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <title>{ariaLabel}</title>
      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(value)}
            y2={y(value)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={y(value)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            {formatValue(value)}
          </text>
        </g>
      ))}

      {values.map((row, dataIndex) => {
        const cx = padding.left + slot * dataIndex + slot / 2;
        let cursor = 0;
        return (
          <g key={dataIndex}>
            {row.map((value, segmentIndex) => {
              const yTop = y(cursor + value);
              const barHeight = Math.max(0, y(cursor) - y(cursor + value));
              cursor += value;
              const isTop = segmentIndex === row.length - 1;
              return (
                <rect
                  key={segments[segmentIndex]?.key ?? segmentIndex}
                  x={cx - barWidth / 2}
                  y={yTop}
                  width={barWidth}
                  height={barHeight}
                  rx={isTop ? 3 : 0}
                  fill={segments[segmentIndex]?.color ?? "var(--chart-2)"}
                />
              );
            })}
          </g>
        );
      })}

      {xTickIndexes.map((index) => (
        <text
          key={index}
          x={padding.left + slot * index + slot / 2}
          y={height - 6}
          textAnchor="middle"
          fontSize={11}
          fill="var(--muted-foreground)"
        >
          {labels[index]}
        </text>
      ))}
    </svg>
  );
}

// #region Donut chart

export type DonutSlice = { key: string; label: string; value: number; color: string };

export function DonutChart({
  slices,
  size = 168,
  thickness = 22,
  centerValue,
  centerLabel
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Precompute cumulative arc offsets so the render pass stays pure.
  const arcs: { slice: DonutSlice; dash: number; offset: number }[] = [];
  let running = 0;
  for (const slice of slices) {
    const dash = (slice.value / total) * circumference;
    arcs.push({ dash, offset: running, slice });
    running += dash;
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <title>{`Distribution across ${slices.length} categories`}</title>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={thickness}
          opacity={0.4}
        />
        {arcs.map(({ slice, dash, offset }) => (
          <circle
            key={slice.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        ))}
      </g>
      {centerValue ? (
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={22}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {centerValue}
        </text>
      ) : null}
      {centerLabel ? (
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fill="var(--muted-foreground)"
        >
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
}
