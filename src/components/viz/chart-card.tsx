import type { ReactNode } from "react";

/** Titled surface for one chart. The title names what is plotted, so a single series needs no legend box. */
export function ChartCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="bg-card space-y-4 rounded-xl border p-5">
      <header className="space-y-1">
        <h2 className="text-base font-medium">{title}</h2>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </header>
      {children}
      {footer}
    </section>
  );
}

/** Every chart has a table twin, so no value depends on colour, hover or the ability to see. */
export function TableView({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="text-sm">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer select-none">
        Table view
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-muted-foreground border-b">
              {columns.map((c) => (
                <th key={c} scope="col" className="py-1.5 pr-4 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                {row.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="py-1.5 pr-4 font-normal">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="py-1.5 pr-4 tabular-nums">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** A single number with its label: the right form when there is only one value to show. */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="bg-background rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {detail && <p className="text-muted-foreground mt-1 text-xs">{detail}</p>}
    </div>
  );
}
