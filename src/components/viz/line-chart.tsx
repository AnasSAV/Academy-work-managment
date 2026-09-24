import { ChartTooltip } from "./chart-tooltip";

export interface LinePoint {
  key: number;
  /** X-axis label. */
  label: string;
  /** Percentage, 0 to 100 or a little above. */
  value: number;
  /** Tooltip title (what the point is). */
  title: string;
  /** Tooltip detail line. */
  detail?: string;
}

interface LineChartProps {
  points: LinePoint[];
  ariaLabel: string;
  /** A reference level (percentage) drawn as a solid hairline with a label. */
  target?: number | null;
}

const W = 640;
const H = 240;
const PAD = { left: 40, right: 60, top: 16, bottom: 34 };

/**
 * One series over time. 2px line with round joins, a faint area wash, 9px markers with a surface
 * ring, hairline solid gridlines, only the last value labelled. A vertical crosshair and tooltip
 * follow the pointer or keyboard focus, so nobody has to aim at a 2px line.
 */
export function LineChart({ points, ariaLabel, target }: LineChartProps) {
  const top = Math.max(
    100,
    Math.ceil(Math.max(...points.map((p) => p.value), target ?? 0) / 25) * 25,
  );
  const ticks = Array.from({ length: top / 25 + 1 }, (_, i) => i * 25);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    points.length === 1 ? PAD.left + plotW / 2 : PAD.left + (plotW * i) / (points.length - 1);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const baseline = y(0);
  const band = Math.max(24, points.length > 1 ? plotW / (points.length - 1) : plotW);
  const labelEvery = points.length > 8 ? 2 : 1;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${baseline} L${x(0)},${baseline} Z`;
  const last = points[points.length - 1];

  return (
    <ChartTooltip>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full overflow-visible"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              strokeWidth={1}
              style={{ stroke: t === 0 ? "var(--viz-axis)" : "var(--viz-grid)" }}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              style={{ fill: "var(--viz-muted)" }}
            >
              {t}%
            </text>
          </g>
        ))}

        {target != null && (
          <g>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(target)}
              y2={y(target)}
              strokeWidth={1}
              style={{ stroke: "var(--viz-muted)" }}
            />
            <text
              x={PAD.left + 6}
              y={y(target) - 5}
              textAnchor="start"
              fontSize={11}
              style={{ fill: "var(--viz-muted)" }}
            >
              Target {target}%
            </text>
          </g>
        )}

        {points.length > 1 && (
          <path d={area} style={{ fill: "var(--viz-series-1)", opacity: 0.1 }} />
        )}
        {points.length > 1 && (
          <path
            d={line}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: "var(--viz-series-1)" }}
          />
        )}

        {points.map((p, i) => (
          <g key={p.key}>
            <circle cx={x(i)} cy={y(p.value)} r={6.5} style={{ fill: "var(--card)" }} />
            <circle cx={x(i)} cy={y(p.value)} r={4.5} style={{ fill: "var(--viz-series-1)" }} />
            {i % labelEvery === 0 && (
              <text
                x={x(i)}
                y={H - 12}
                textAnchor="middle"
                fontSize={11}
                style={{ fill: "var(--viz-muted)" }}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}

        <text
          x={x(points.length - 1) + 12}
          y={y(last.value) + 4}
          fontSize={13}
          fontWeight={600}
          style={{ fill: "var(--foreground)" }}
        >
          {Math.round(last.value * 10) / 10}%
        </text>

        {points.map((p, i) => (
          <g
            key={`hit-${p.key}`}
            tabIndex={0}
            data-tip-title={p.title}
            data-tip-value={`${Math.round(p.value * 10) / 10}%`}
            data-tip-detail={p.detail}
            data-tip-color="var(--viz-series-1)"
            className="group/hit outline-none"
          >
            <line
              x1={x(i)}
              x2={x(i)}
              y1={PAD.top}
              y2={baseline}
              strokeWidth={1}
              className="opacity-0 group-hover/hit:opacity-100 group-focus/hit:opacity-100"
              style={{ stroke: "var(--viz-muted)" }}
            />
            <rect x={x(i) - band / 2} y={PAD.top} width={band} height={plotH} fill="transparent" />
          </g>
        ))}
      </svg>
    </ChartTooltip>
  );
}
