import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import { modules, semesters } from "@/db/schema";
import { SEED_MODULES, seedDatabase } from "@/db/seed";
import { MODULE_COLORS } from "@/lib/defaults";

const OLD_DEFAULTS = [
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
];

const migrationSql = fs.readFileSync(
  path.join(process.cwd(), "src/db/migrations/0001_recolor_default_modules.sql"),
  "utf8",
);

function runRecolor(db: Db) {
  (db as unknown as { $client: { exec(sql: string): void } }).$client.exec(migrationSql);
}

describe("module colours", () => {
  it("are the validated palette slots, in order, all distinct", () => {
    // Order matters: adjacent slots are the ones checked for colour-vision separation.
    expect([...MODULE_COLORS]).toEqual([
      "#2a78d6",
      "#eb6834",
      "#1baf7a",
      "#eda100",
      "#e87ba4",
      "#008300",
      "#4a3aa7",
      "#e34948",
    ]);
    expect(new Set(MODULE_COLORS).size).toBe(MODULE_COLORS.length);
    for (const c of MODULE_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("are what a fresh seed assigns to the six modules", () => {
    const db = createDatabase(":memory:");
    seedDatabase(db);
    const colors = db
      .select()
      .from(modules)
      .orderBy(modules.position)
      .all()
      .map((m) => m.color);
    expect(colors).toEqual(MODULE_COLORS.slice(0, SEED_MODULES.length));
  });
});

describe("recolour migration", () => {
  function moduleWith(db: Db, semesterId: number, name: string, color: string) {
    return db.insert(modules).values({ semesterId, name, color }).returning().get();
  }

  it("moves each old default to its palette slot", () => {
    const db = createDatabase(":memory:");
    const s = db.insert(semesters).values({ name: "S" }).returning().get();
    const rows = OLD_DEFAULTS.map((c, i) => moduleWith(db, s.id, `M${i}`, c));

    runRecolor(db);

    const after = db.select().from(modules).orderBy(modules.id).all();
    expect(after.map((m) => m.color)).toEqual([...MODULE_COLORS]);
    expect(after.map((m) => m.id)).toEqual(rows.map((r) => r.id));
  });

  it("leaves a hand-picked colour alone and is safe to run twice", () => {
    const db = createDatabase(":memory:");
    const s = db.insert(semesters).values({ name: "S" }).returning().get();
    moduleWith(db, s.id, "Custom", "#123456");
    moduleWith(db, s.id, "Default", "#3b82f6");

    runRecolor(db);
    runRecolor(db);

    const byName = Object.fromEntries(
      db
        .select()
        .from(modules)
        .all()
        .map((m) => [m.name, m.color]),
    );
    expect(byName).toEqual({ Custom: "#123456", Default: "#2a78d6" });
  });

  it("does not disturb any other column", () => {
    const db = createDatabase(":memory:");
    const s = db.insert(semesters).values({ name: "S" }).returning().get();
    const created = db
      .insert(modules)
      .values({
        semesterId: s.id,
        name: "Networks",
        code: "CN",
        credits: 15,
        targetGrade: 80,
        color: "#ef4444",
        position: 3,
      })
      .returning()
      .get();

    runRecolor(db);

    const after = db.select().from(modules).get()!;
    expect({ ...after, color: created.color }).toEqual(created);
    expect(after.color).toBe("#008300");
  });
});
