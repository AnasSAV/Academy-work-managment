"use client";

import { useState } from "react";
import { TargetMessage } from "@/components/target-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatPercent,
  itemPercent,
  projectGrade,
  summarizeGrades,
  targetStatus,
  type GradeItem,
} from "@/lib/grades";

interface WhatIfCalculatorProps {
  items: GradeItem[];
  /** The module's target grade, used as the starting target. */
  initialTarget: number | null;
}

/** "" -> null, otherwise a number in 0-100, or NaN when out of range or not a number. */
function parsePercent(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : Number.NaN;
}

/** A sensible starting assumption: what is needed for the target, else the current average. */
function startingAssumption(items: GradeItem[], target: number | null): string {
  const summary = summarizeGrades(items);
  const status = targetStatus(summary, target);
  if (status.kind === "needed") return String(Math.ceil(status.average * 10) / 10);
  if (summary.average !== null) return String(Math.round(summary.average));
  return "70";
}

/**
 * Try out scores on the work that is left and see the resulting grade. Nothing is saved: it is a
 * scratchpad. Graded scores are fixed; blank rows use the "assume" score.
 */
export function WhatIfCalculator({ items, initialTarget }: WhatIfCalculatorProps) {
  const [target, setTarget] = useState(initialTarget === null ? "" : String(initialTarget));
  const [fallback, setFallback] = useState(() => startingAssumption(items, initialTarget));
  const [rows, setRows] = useState<Record<number, string>>({});

  const summary = summarizeGrades(items);
  const outstanding = items.filter((i) => itemPercent(i) === null);

  const targetValue = parsePercent(target);
  const fallbackValue = parsePercent(fallback);
  const targetOk = targetValue === null || !Number.isNaN(targetValue);
  const status = targetStatus(summary, targetOk ? targetValue : null);

  const assumed: Record<number, number | null> = {};
  const rowErrors: Record<number, string> = {};
  for (const item of outstanding) {
    const value = parsePercent(rows[item.id] ?? "");
    if (value !== null && Number.isNaN(value)) rowErrors[item.id] = "Enter 0 to 100";
    else assumed[item.id] = value;
  }
  const fallbackUsable = fallbackValue !== null && !Number.isNaN(fallbackValue);
  const projection = projectGrade(items, assumed, fallbackUsable ? fallbackValue : null);
  const gap = targetOk && targetValue !== null ? projection.grade - targetValue : null;

  if (outstanding.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        Everything is graded, so there is nothing left to try out.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <Label htmlFor="whatif-target">Target grade (%)</Label>
          <Input
            id="whatif-target"
            type="number"
            min={0}
            max={100}
            step="any"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-invalid={!targetOk}
          />
          <p className={targetOk ? "text-muted-foreground text-xs" : "text-destructive text-xs"}>
            {targetOk
              ? "Try any target. Your module's own target is not changed."
              : "Enter 0 to 100."}
          </p>
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="whatif-fallback">Assume this score wherever I leave a blank (%)</Label>
          <div className="flex gap-2">
            <Input
              id="whatif-fallback"
              type="number"
              min={0}
              max={100}
              step="any"
              inputMode="decimal"
              value={fallback}
              onChange={(e) => setFallback(e.target.value)}
              aria-invalid={fallback !== "" && !fallbackUsable}
            />
            {status.kind === "needed" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setFallback(String(Math.ceil(status.average * 10) / 10))}
              >
                Use the needed average
              </Button>
            )}
          </div>
          <p
            className={
              fallback !== "" && !fallbackUsable
                ? "text-destructive text-xs"
                : "text-muted-foreground text-xs"
            }
          >
            {fallback !== "" && !fallbackUsable
              ? "Enter 0 to 100."
              : "Applies to every component below without its own score."}
          </p>
        </div>
      </div>

      <div>
        <div
          aria-hidden
          className="text-muted-foreground hidden border-b py-2 text-sm font-medium sm:grid sm:grid-cols-[1fr_5rem_8rem_6rem] sm:gap-x-3"
        >
          <span>Still to be graded</span>
          <span>Weight</span>
          <span>Score to try (%)</span>
          <span className="text-right">Adds</span>
        </div>
        <ul
          aria-label="Scores to try out on the components still to be graded"
          className="divide-y"
        >
          {outstanding.map((item) => {
            const own = assumed[item.id];
            const used = own ?? (fallbackUsable ? fallbackValue : null);
            const points = used === null ? null : (item.weight * used) / 100;
            const error = rowErrors[item.id];
            return (
              <li
                key={item.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-3 text-sm sm:grid-cols-[1fr_5rem_8rem_6rem]"
              >
                <span>{item.name}</span>
                <span className="text-muted-foreground sm:text-foreground tabular-nums">
                  <span className="sm:hidden">Weight </span>
                  {formatPercent(item.weight)}
                </span>
                <div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    inputMode="decimal"
                    aria-label={`Score to try for ${item.name}`}
                    aria-invalid={!!error}
                    placeholder={fallbackUsable ? String(fallbackValue) : "blank"}
                    value={rows[item.id] ?? ""}
                    onChange={(e) => setRows((r) => ({ ...r, [item.id]: e.target.value }))}
                  />
                  {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
                </div>
                <span className="text-right tabular-nums">
                  {points === null ? "counts as 0" : `+${Math.round(points * 100) / 100}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div role="status" aria-live="polite" className="bg-muted/40 space-y-4 rounded-lg border p-4">
        <div>
          <p className="text-muted-foreground text-sm">Projected final grade</p>
          <p className="text-5xl font-semibold" data-testid="projected-grade">
            {formatPercent(projection.grade)}
          </p>
          {gap !== null && (
            <p className="mt-1 text-sm">
              {Math.abs(gap) < 0.05
                ? `Right on your ${formatPercent(targetValue as number)} target.`
                : gap > 0
                  ? `${formatPercent(gap)} above your ${formatPercent(targetValue as number)} target.`
                  : `${formatPercent(-gap)} short of your ${formatPercent(targetValue as number)} target.`}
            </p>
          )}
          {projection.unfilled > 0 && (
            <p className="text-muted-foreground mt-1 text-xs">
              {projection.unfilled}{" "}
              {projection.unfilled === 1 ? "component has" : "components have"} no score to try and{" "}
              {projection.unfilled === 1 ? "counts" : "count"} as 0.
            </p>
          )}
        </div>
        <TargetMessage status={status} target={targetOk ? targetValue : null} summary={summary} />
      </div>
    </div>
  );
}
