"use client";

import { useState } from "react";
import { Backend, phaseColor, stageRanges } from "@/lib/backends";
import { ArrowUpRight, Check, Link } from "./Icons";
import { StageIcon } from "./StageIcon";

export interface LaneState {
  status: "idle" | "running" | "done" | "error";
  startedAt?: number;
  targetWall?: number;
  reportedMs?: number;
  live?: boolean;
  sim?: boolean;
  count?: number;
  note?: string;
  error?: string;
  readUrl?: string | null;
  segments?: number | null;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function fmtMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

export function Lane({
  backend,
  lane,
  fastest,
}: {
  backend: Backend;
  lane: LaneState;
  fastest: number | null;
}) {
  const ranges = stageRanges(backend.stages);
  const [open, setOpen] = useState<string | null>(null);

  let progress = 0;
  let timerMs = 0;
  if (lane.status === "running" && lane.startedAt) {
    timerMs = Date.now() - lane.startedAt;
    progress = clamp(timerMs / (lane.targetWall || 1), 0, 0.985);
  } else if (lane.status === "done") {
    progress = 1;
    timerMs = lane.reportedMs ?? 0;
  }
  const isWinner =
    lane.status === "done" && lane.reportedMs != null && lane.reportedMs === fastest;
  const current =
    lane.status === "running"
      ? ranges.find((r) => progress >= r.start && progress < r.end)
      : null;

  const toggle = (key: string) => setOpen((o) => (o === key ? null : key));

  return (
    <div className="border-b border-line py-5">
      {/* header */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="font-medium">{backend.name}</span>
          {current ? (
            <span className="text-[12px]" style={{ color: phaseColor(current.key) }}>
              {current.label}…
            </span>
          ) : (
            <span className="hidden text-[12px] text-muted sm:inline">{backend.blurb}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="tnum font-mono text-xl">
            {lane.status === "idle" ? "—" : lane.status === "error" ? "err" : fmtMs(timerMs)}
          </span>
          {lane.readUrl && <ShareLink url={lane.readUrl} />}
        </div>
      </div>

      {/* THE BAR — the hero. Click anywhere on a phase. */}
      <div className="mt-3 flex h-4 w-full gap-1">
        {ranges.map((r) => {
          const span = Math.max(r.end - r.start, 0.0001);
          const local = clamp((progress - r.start) / span, 0, 1) * 100;
          const color = phaseColor(r.key);
          const active = open === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => toggle(r.key)}
              title={r.label}
              className="relative h-full cursor-pointer overflow-hidden rounded-[3px]"
              style={{
                flexGrow: r.weight,
                flexBasis: 0,
                background: hexA(color, 0.16),
                boxShadow: active ? `inset 0 0 0 1.5px ${hexA(color, 0.6)}` : "none",
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-[3px]"
                style={{ width: `${local}%`, background: color, transition: "width 0.1s linear" }}
              />
            </button>
          );
        })}
      </div>

      {/* labels — always visible, ALIGNED to the bar segments, with a color
          dot so the connection to each phase is clear */}
      <div className="mt-2 flex w-full gap-1">
        {ranges.map((r) => {
          const active = open === r.key;
          const color = phaseColor(r.key);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => toggle(r.key)}
              style={{ flexGrow: r.weight, flexBasis: 0 }}
              className="flex items-center gap-1 pt-1 text-left"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
              <span
                className="truncate text-[10px]"
                style={{ color: active ? color : "var(--muted)" }}
                title={r.label}
              >
                {r.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* the icons + definitions are deeper info — only revealed once a network
          is opened. Expands smoothly via CSS grid; fixed height inside so it
          never resizes vertically, and the text is always rendered (opacity
          crossfade) so switching steps never remounts/flashes. */}
      <div
        className="grid"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 0.3s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          {open !== null && (
            <div className="mt-1.5 flex items-stretch gap-1.5" style={{ height: 112 }}>
              {ranges.map((r) => {
                const isOpen = open === r.key;
                const color = phaseColor(r.key);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggle(r.key)}
                    title={r.label}
                    className="flex items-start gap-2 overflow-hidden rounded-[4px] text-left"
                    style={{
                      flexGrow: isOpen ? 1 : 0,
                      flexBasis: isOpen ? 0 : "26px",
                      minWidth: "26px",
                      padding: isOpen ? "10px 12px" : "8px 4px",
                      background: isOpen ? hexA(color, 0.05) : hexA(color, 0.1),
                      transition:
                        "flex-grow 0.34s cubic-bezier(0.22,1,0.36,1), flex-basis 0.34s cubic-bezier(0.22,1,0.36,1), background 0.3s ease, padding 0.3s ease",
                    }}
                  >
                    <span className="shrink-0" style={{ color }}>
                      <StageIcon name={r.icon} size={18} />
                    </span>
                    {/* fixed-width text → never reflows; opacity crossfades on switch */}
                    <span
                      className="block"
                      style={{ width: 430, opacity: isOpen ? 1 : 0, transition: "opacity 0.26s ease" }}
                    >
                      <span className="block text-[12px] font-medium" style={{ color }}>
                        {r.label}
                      </span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-muted">{r.why}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* meta */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
        <StatusTag lane={lane} winner={isWinner} />
        {lane.segments != null && <span>· {lane.segments.toLocaleString()} txs</span>}
        {lane.note && <span className="text-accent">· {lane.note}</span>}
        {lane.error && <span className="text-red-500">· {lane.error}</span>}
      </div>
    </div>
  );
}

function StatusTag({ lane, winner }: { lane: LaneState; winner: boolean }) {
  const live = lane.live === true;
  return (
    <span className="flex items-center gap-1">
      {live ? (
        <>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          live upload
        </>
      ) : lane.sim ? (
        lane.count ? `avg of ${lane.count} run${lane.count === 1 ? "" : "s"}` : "no runs yet"
      ) : lane.status === "done" ? (
        "modeled"
      ) : (
        ""
      )}
      {winner && <span className="text-ink">· fastest</span>}
    </span>
  );
}

function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const abs =
    typeof window !== "undefined" && url.startsWith("/") ? window.location.origin + url : url;
  return (
    <span className="flex items-center gap-1.5">
      <a href={url} target="_blank" rel="noreferrer" title="view it" className="text-muted hover:text-ink">
        <ArrowUpRight size={14} />
      </a>
      <button
        title="copy link"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(abs);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {}
        }}
        className="text-muted hover:text-ink"
      >
        {copied ? <Check size={13} /> : <Link size={13} />}
      </button>
    </span>
  );
}
