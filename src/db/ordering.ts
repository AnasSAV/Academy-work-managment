import { asc, eq, max, type SQL } from "drizzle-orm";
import type { Db } from "./index";
import type { chapters, modules, semesters } from "./schema";

/** Any table with an integer `id` and a `position` used to order siblings. */
export type OrderedTable = typeof semesters | typeof modules | typeof chapters;

/** Position for a new row placed after its siblings. */
export function nextPosition(db: Db, table: OrderedTable, siblings?: SQL): number {
  const row = db
    .select({ top: max(table.position) })
    .from(table)
    .where(siblings)
    .get();
  return (row?.top ?? -1) + 1;
}

/**
 * Swap a row with its neighbour. Siblings are renumbered 0..n-1 on every move, which also
 * cleans up gaps or ties. Returns false when the row is already at that end (or not found).
 */
export function moveRow(
  db: Db,
  table: OrderedTable,
  siblings: SQL | undefined,
  id: number,
  direction: "up" | "down",
): boolean {
  const rows = db
    .select({ id: table.id })
    .from(table)
    .where(siblings)
    .orderBy(asc(table.position), asc(table.id))
    .all();
  const from = rows.findIndex((r) => r.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= rows.length) return false;

  const order = rows.map((r) => r.id);
  [order[from], order[to]] = [order[to], order[from]];
  db.transaction((tx) => {
    order.forEach((rowId, position) => {
      tx.update(table).set({ position }).where(eq(table.id, rowId)).run();
    });
  });
  return true;
}
