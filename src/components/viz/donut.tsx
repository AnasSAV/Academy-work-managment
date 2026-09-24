import { ChartTooltip } from "./chart-tooltip";

export interface DonutSegment {
  key: string;
  label: string;
  /** Weight in the same units as `whole`. */
  weight: number;
  /** CSS colour (a chart token). */
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  whole: number;
  ariaLabel: string;
  centerValue: string;
  centerLabel: string;
}

const SIZE = 176;
const STROKE = 20;
const GAP = 2;

const fmt = (n: number) => `${Math.round(n * 100) / 100}%`;

/**
 * Part to whole as a ring, with 2px surface gaps between segments. A donut is weak for comparing
 * close values, so the legend is always shown with the numbers, and every segment carries a
 * tooltip and appears in the table view.
 */
export function Donut({ segments, whole, ariaLabel, centerValue, centerLabel }: DonutProps) {
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter((s) => s.weight > 0);

  const lengths = visible.map((s) => (s.weight / whole) * circumference);
  const arcs = visible.map((s, i) => ({
    ...s,
    dash: visible.length === 1 ? lengths[i] : Math.max(lengths[i] - GAP, 0.5),
    offset: lengths.slice(0, i).reduce((sum, n) => sum + n, 0),
  }));

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <ChartTooltip className="shrink-0">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={ariaLabel}
          >
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={radius}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${a.dash} ${circumference - a.dash}`}
                strokeDashoffset={-a.offset}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                tabIndex={0}
                data-tip-title={a.label}
                data-tip-value={fmt(a.weight)}
                data-tip-detail="of the module grade"
                data-tip-color={a.color}
                className="outline-none hover:opacity-80 focus-visible:opacity-80"
                style={{ stroke: a.color }}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl leading-none font-semibold">{centerValue}</span>
            <span className="text-muted-foreground mt-1 text-xs">{centerLabel}</span>
          </div>
        </div>
      </ChartTooltip>

      <ul aria-label="Legend" className="w-full max-w-72 min-w-48 space-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
            />
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums">{fmt(s.weight)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
