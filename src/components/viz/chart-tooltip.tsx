"use client";

import { useRef, useState, type ReactNode } from "react";

interface Tip {
  x: number;
  y: number;
  title: string;
  value: string;
  detail: string | null;
  color: string | null;
}

/**
 * One tooltip for a whole chart. The marks stay server-rendered; any element carrying
 * `data-tip-title` / `data-tip-value` (and optionally `data-tip-detail`, `data-tip-color`) gets a
 * tooltip on hover, touch and keyboard focus. The text is read as plain strings and rendered as
 * text, never as markup, because labels come from user data.
 */
export function ChartTooltip({ children, className }: { children: ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  function show(target: EventTarget | null, at: "pointer" | "element", clientX = 0, clientY = 0) {
    const box = wrap.current?.getBoundingClientRect();
    const el = target instanceof Element ? target.closest<HTMLElement>("[data-tip-title]") : null;
    if (!box || !el || !wrap.current?.contains(el)) return setTip(null);

    let x = clientX;
    let y = clientY;
    if (at === "element") {
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top;
    }
    // Keep the tooltip inside the chart; it is at most 16rem wide.
    const half = 128;
    setTip({
      x: Math.min(Math.max(x - box.left, half), Math.max(half, box.width - half)),
      y: y - box.top,
      title: el.dataset.tipTitle ?? "",
      value: el.dataset.tipValue ?? "",
      detail: el.dataset.tipDetail ?? null,
      color: el.dataset.tipColor ?? null,
    });
  }

  return (
    <div
      ref={wrap}
      className={`relative ${className ?? ""}`}
      onPointerMove={(e) => show(e.target, "pointer", e.clientX, e.clientY)}
      onPointerDown={(e) => show(e.target, "pointer", e.clientX, e.clientY)}
      onPointerLeave={() => setTip(null)}
      onFocus={(e) => show(e.target, "element")}
      onBlur={() => setTip(null)}
      onKeyDown={(e) => e.key === "Escape" && setTip(null)}
    >
      {children}
      {tip && (
        <div
          role="tooltip"
          className="bg-popover text-popover-foreground ring-foreground/10 pointer-events-none absolute z-20 w-max max-w-64 -translate-x-1/2 -translate-y-full rounded-lg px-3 py-2 text-xs shadow-md ring-1"
          style={{ left: tip.x, top: Math.max(tip.y - 10, 0) }}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            {tip.color && (
              <span
                aria-hidden
                className="inline-block h-0.5 w-3.5 shrink-0 rounded-full"
                style={{ background: tip.color }}
              />
            )}
            {tip.value}
          </p>
          <p className="text-muted-foreground mt-0.5">{tip.title}</p>
          {tip.detail && <p className="text-muted-foreground mt-0.5">{tip.detail}</p>}
        </div>
      )}
    </div>
  );
}
