"use client";

import { useState } from "react";
import { COMPARE, COMPARE_NETS } from "@/lib/comparison";
import { Dash, Plus } from "./Icons";

// A standalone, in-depth comparison — its own white card (deliberately NOT a FAQ
// row), collapsed by default. Open it for an Apple-spec-sheet layout: networks
// as columns, one titled section at a time, terse factual lines.
export default function Compare() {
  const [open, setOpen] = useState(false);
  const cols = `repeat(${COMPARE_NETS.length}, minmax(0, 1fr))`;

  return (
    <section className="mt-6">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-20px_rgba(0,0,0,0.12)] sm:p-6">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="mt-0.5 text-muted">{open ? <Dash size={18} /> : <Plus size={18} />}</span>
          <span className="flex-1">
            <span className="block font-semibold">Compare Storage Networks</span>
            <span className="mt-0.5 block text-[12px] text-muted">
              Cost, speed, durability, permanence, privacy, and proof — side by side.
            </span>
          </span>
        </button>

        {open && (
          <div className="mt-6">
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* network columns — identified once, at the top */}
                <div className="grid items-start gap-x-3 pb-1" style={{ gridTemplateColumns: cols }}>
                  {COMPARE_NETS.map((n) => (
                    <div key={n.id} className="flex items-center gap-1.5">
                      <img
                        src={n.logo}
                        alt=""
                        width={20}
                        height={20}
                        loading="lazy"
                        className="rounded-sm"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                      />
                      <span className="relative inline-block text-[15px] font-semibold">
                        {n.name}
                        {n.badge && (
                          // a little sticker slapped on the word's bottom-right
                          // corner — looks peel-off-able once it launches
                          <span className="absolute -bottom-2 -right-3 whitespace-nowrap rounded-[3px] bg-[#f3cf5e] px-1 py-px text-[8px] font-semibold leading-none text-[#5e4708]">
                            {n.badge}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {/* one section at a time — rendered FACT-ROW by fact-row (not
                    column-stacks) so the i-th fact of every network lines up */}
                {COMPARE.map((sec) => {
                  const rows = Math.max(...COMPARE_NETS.map((n) => sec.cells[n.id]?.length ?? 0));
                  return (
                    <div key={sec.key}>
                      <div className="mt-5 border-b border-line pb-2 text-[13px] font-semibold text-ink">
                        {sec.title}
                      </div>
                      <div className="pt-3">
                        {Array.from({ length: rows }).map((_, i) => (
                          <div key={i} className="grid items-start gap-x-3" style={{ gridTemplateColumns: cols }}>
                            {COMPARE_NETS.map((n) => (
                              <div
                                key={n.id}
                                className={
                                  i === 0
                                    ? "pb-1 pr-2 text-[12px] leading-snug text-ink"
                                    : "pb-1 pr-2 text-[11px] leading-snug text-muted"
                                }
                              >
                                {sec.cells[n.id]?.[i] ?? ""}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
