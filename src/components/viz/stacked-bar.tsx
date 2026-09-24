import { ChartTooltip } from "./chart-tooltip";

export interface StackSegment {
  key: string;
  label: string;
  /** Size in the same units as `whole`. */
  value: number;
  /** CSS colour (a chart token). */
  color: string;
  /** Tooltip value text. */
  valueText: string;
  detail?: string;
}

interface StackedBarProps {
  segments: StackSegment[];
  whole: number;
  ariaLabel: string;
  /** A reference position drawn as a hairline with a label above the bar. */
  marker?: { value: number; label: string } | null;
}

/**
 * Part to whole as one horizontal bar. Segments are separated by a 2px gap in the surface colour,
 * the bar is thin and square at its baseline. Segments carry no inline text (it would not fit the
 * small ones), so the legend below and the tooltips carry the values.
 */
export function StackedBar({ segments, whole, ariaLabel, marker }: StackedBarProps) {
  const visible = segments.filter((s) => s.value > 0);
  const markerAt = marker ? Math.min(Math.max((marker.value / whole) * 100, 0), 100) : null;

  return (
    <div className="space-y-3">
      <ChartTooltip>
        <div className="relative pt-6">
          {marker && markerAt !== null && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10"
              style={{ left: `${markerAt}%` }}
            >
              <span
                className="text-muted-foreground absolute top-0 -translate-x-1/2 text-xs whitespace-nowrap"
                style={{ transform: markerAt > 88 ? "translateX(-100%)" : "translateX(-50%)" }}
              >
                {marker.label}
              </span>
              <span
                aria-hidden
                className="absolute top-5 bottom-0 w-0.5 -translate-x-1/2"
                style={{ background: "var(--foreground)" }}
              />
            </div>
          )}
          <div
            role="img"
            aria-label={ariaLabel}
            className="flex h-5 overflow-hidden rounded-r-[4px]"
            style={{ background: "var(--viz-empty)" }}
          >
            {visible.map((s, i) => (
              <div
                key={s.key}
                tabIndex={0}
                data-tip-title={s.label}
                data-tip-value={s.valueText}
                data-tip-detail={s.detail}
                data-tip-color={s.color}
                className="h-full outline-none hover:opacity-80 focus-visible:opacity-80"
                style={{
                  width: `${(s.value / whole) * 100}%`,
                  background: s.color,
                  boxShadow: i < visible.length - 1 ? "inset -2px 0 0 var(--card)" : undefined,
                }}
              />
            ))}
          </div>
        </div>
      </ChartTooltip>

      <ul aria-label="Legend" className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
            />
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums">{s.valueText}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
