import Link from "next/link";
import { toPercent } from "@/lib/progress";
import { ChartTooltip } from "./chart-tooltip";

export interface BarRow {
  key: string | number;
  label: string;
  /** 0 to 1. */
  value: number;
  /** Shown at the tip of the bar; defaults to the percentage. */
  valueText?: string;
  /** Secondary text under the label. */
  sub?: string;
  /** Bar colour. Falls back to the chart's single-series colour. */
  color?: string;
  /** Show a coloured dot beside the label: for bars that are different entities (modules). */
  dot?: boolean;
  href?: string;
  /** Tooltip detail line. */
  detail?: string;
}

/**
 * Horizontal bars from one baseline. Marks are thin (10px), square at the baseline and rounded at
 * the data end, over a track that is a tint of the bar's own colour. The value sits at the tip of
 * each bar; labels use text colours, and a coloured dot beside the label carries identity.
 */
export function BarList({ rows, ariaLabel }: { rows: BarRow[]; ariaLabel: string }) {
  return (
    <ChartTooltip>
      <ul aria-label={ariaLabel} className="space-y-3">
        {rows.map((row) => {
          const color = row.color ?? "var(--viz-series-1)";
          const pct = toPercent(row.value);
          const valueText = row.valueText ?? `${pct}%`;
          const label = (
            <span className="flex min-w-0 items-center gap-2">
              {row.dot && (
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                />
              )}
              <span className="truncate">{row.label}</span>
            </span>
          );
          return (
            <li
              key={row.key}
              tabIndex={row.href ? undefined : 0}
              data-tip-title={row.label}
              data-tip-value={valueText}
              data-tip-detail={row.detail ?? row.sub}
              data-tip-color={color}
              className="focus-visible:ring-ring/50 grid grid-cols-[1fr_auto] items-center gap-x-3 rounded outline-none focus-within:ring-2 focus-visible:ring-2 sm:grid-cols-[minmax(8rem,15rem)_1fr_3rem]"
            >
              <div className="order-1 min-w-0 text-sm">
                {row.href ? (
                  <Link href={row.href} className="block min-w-0 hover:underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
                {row.sub && <p className="text-muted-foreground text-xs break-words">{row.sub}</p>}
              </div>
              <div
                aria-hidden
                className="order-3 col-span-2 mt-1.5 h-2.5 overflow-hidden rounded-r-[4px] sm:order-2 sm:col-span-1 sm:mt-0"
                style={{ background: `color-mix(in oklab, ${color} 16%, var(--card))` }}
              >
                <div
                  className="h-full rounded-r-[4px]"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="order-2 text-right text-sm font-medium tabular-nums sm:order-3">
                {valueText}
              </span>
            </li>
          );
        })}
      </ul>
    </ChartTooltip>
  );
}
