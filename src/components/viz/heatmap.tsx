import Link from "next/link";
import { HEAT_LABELS, heatLevel, type HeatLevel } from "@/lib/dashboard";
import { toPercent } from "@/lib/progress";
import { ChartTooltip } from "./chart-tooltip";

export interface HeatCell {
  key: number;
  /** Chapter title. */
  title: string;
  /** 0 to 1. */
  progress: number;
  href: string;
  /** Tooltip detail line, e.g. which activities are done. */
  detail: string;
}

export interface HeatRow {
  key: number;
  label: string;
  color: string;
  href: string;
  cells: HeatCell[];
}

const LEVEL_COLOR: Record<HeatLevel, string> = {
  0: "var(--viz-empty)",
  1: "var(--viz-ramp-1)",
  2: "var(--viz-ramp-2)",
  3: "var(--viz-ramp-3)",
  4: "var(--viz-ramp-4)",
};

/** The colour key: one swatch per class, so the scale never depends on guessing. */
export function HeatLegend() {
  return (
    <ul
      aria-label="Colour key"
      className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
    >
      {([0, 1, 2, 3, 4] as HeatLevel[]).map((level) => (
        <li key={level} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-[3px]"
            style={{ background: LEVEL_COLOR[level] }}
          />
          {HEAT_LABELS[level]}
        </li>
      ))}
    </ul>
  );
}

/**
 * Modules by chapters: one cell per chapter, coloured by how far along it is. A real table, so
 * screen readers get rows and columns; each cell is a link to its chapter and shows a tooltip on
 * hover or focus. Cells are 22px with a 2px gap (a 24px hit target each).
 */
export function Heatmap({ rows }: { rows: HeatRow[] }) {
  const columns = Math.max(0, ...rows.map((r) => r.cells.length));

  return (
    <ChartTooltip>
      <div className="overflow-x-auto pb-1">
        <table className="border-separate border-spacing-[2px]">
          <caption className="sr-only">
            Chapter progress by module. Each cell is one chapter, coloured by how much is done.
          </caption>
          <thead>
            <tr>
              <td />
              {Array.from({ length: columns }, (_, i) => (
                <th
                  key={i}
                  scope="col"
                  className="text-muted-foreground w-[22px] pb-1 text-center text-[11px] font-normal tabular-nums"
                >
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="max-w-32 pr-3 text-left text-sm font-normal sm:max-w-72">
                  <Link
                    href={row.href}
                    title={row.label}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: row.color }}
                    />
                    <span className="truncate">{row.label}</span>
                  </Link>
                </th>
                {row.cells.length === 0 ? (
                  <td colSpan={Math.max(columns, 1)} className="text-muted-foreground text-xs">
                    No chapters yet
                  </td>
                ) : (
                  row.cells.map((cell) => {
                    const level = heatLevel(cell.progress);
                    const percent = `${toPercent(cell.progress)}%`;
                    return (
                      <td key={cell.key} className="p-0">
                        <Link
                          href={cell.href}
                          aria-label={`${row.label}, ${cell.title}: ${percent}`}
                          data-tip-title={`${row.label} · ${cell.title}`}
                          data-tip-value={`${percent} · ${HEAT_LABELS[level]}`}
                          data-tip-detail={cell.detail}
                          className="hover:outline-foreground/60 focus-visible:outline-foreground block size-[22px] rounded-[4px] outline-2 outline-transparent"
                          style={{ background: LEVEL_COLOR[level] }}
                        />
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartTooltip>
  );
}
