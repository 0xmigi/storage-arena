"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { BACKENDS, BACKEND_ORDER, BackendId, projectMs, segmentCount, PHASES } from "@/lib/backends";
import { Close, Play, Plus, Upload } from "./Icons";
import { Lane as LaneView } from "./Lane";

// setTimeout's signed-32-bit ceiling (~24.8 days). Past this a delay overflows
// and fires immediately — so a lane longer than this just runs its real clock
// and never auto-completes (honest: it really would take that long).
const MAX_TIMEOUT = 2_147_483_000;

// Simulation size range — log-scaled slider, 1 KB → 10 GB. Sizes beyond what's
// actually been uploaded are reached by EXTRAPOLATING each network's linear fit
// of its recorded runs (clearly labeled as extrapolation in the UI).
const SIM_MIN = 1024;
const SIM_MAX = 10 * 1024 * 1024 * 1024;
const sliderToBytes = (t: number) => Math.round(SIM_MIN * Math.pow(SIM_MAX / SIM_MIN, t));
const bytesToSlider = (b: number) =>
  Math.log(b / SIM_MIN) / Math.log(SIM_MAX / SIM_MIN);
const SIM_PRESETS: { label: string; bytes: number }[] = [
  { label: "1 KB", bytes: 1024 },
  { label: "1 MB", bytes: 1024 * 1024 },
  { label: "100 MB", bytes: 100 * 1024 * 1024 },
  { label: "1 GB", bytes: 1024 * 1024 * 1024 },
  { label: "10 GB", bytes: 10 * 1024 * 1024 * 1024 },
];
function fmtSize(n: number) {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 * 1024 ? 2 : 1)} GB`;
}

type Status = "idle" | "running" | "done" | "error";
interface Lane {
  status: Status;
  startedAt?: number;
  targetWall?: number;
  reportedMs?: number;
  live?: boolean;
  sim?: boolean;
  count?: number;
  fellBack?: boolean;
  note?: string;
  readUrl?: string | null;
  blobId?: string | null;
  segments?: number | null;
  bytes?: number;
  simTag?: string;
  error?: string;
}
const idleLanes = () =>
  Object.fromEntries(
    BACKEND_ORDER.map((id) => [id, { status: "idle" } as Lane])
  ) as Record<BackendId, Lane>;

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// A network's linear fit (ms ≈ intercept + slope·bytes) over its recorded runs.
type Fit = {
  slope: number | null;
  intercept: number | null;
  n: number;
  minBytes: number;
  maxBytes: number;
  avgMs: number;
};
const SIZE_BAND = 4; // when a network has only one size cluster, its flat avg is
// only trusted within this multiplicative window of the recorded size.
// A linear fit can't be trusted indefinitely past its data — a ×512 stretch off
// 2 points is noise. Beyond this many × past the measured max (or below the min)
// we drop the extrapolation and use the model, so far sizes stay comparable.
const MAX_EXTRAP = 10;
// Extrapolation needs real evidence, not 2 noisy points. Below this many runs we
// only INTERPOLATE within the measured range and otherwise use the model — so a
// sparse, noisy fit never gets compared against modeled lanes and inverts them.
const EXTRAP_MIN_N = 5;

// Predict a network's time at `bytes`, plus an honest label of how it was
// reached. ALWAYS returns an estimate — real recorded data is used when there's
// enough of it (interpolated/extrapolated/avg), otherwise it falls back to the
// hardcoded baseline model (`projectMs`, labeled "modeled"). The sim never dead-
// ends: a missing fit just means we show the model instead of measured data.
function predictSim(
  fit: Fit | undefined,
  bytes: number,
  id: BackendId
): { ms: number; tag: string } {
  if (fit && fit.n >= 1) {
    // A usable slope must be PHYSICALLY POSITIVE — a bigger file can't upload
    // faster. A negative/zero slope means the data is overhead-dominated over
    // too narrow a size range (e.g. Tapedrive's runs are all sub-5 KB), so the
    // line is noise and must NOT be extrapolated ("10 GB in 1 ms").
    const usableSlope =
      fit.slope != null && fit.slope > 0 && fit.intercept != null && fit.maxBytes > fit.minBytes && fit.n >= 2;
    if (usableSlope) {
      const ms = Math.max(1, fit.intercept! + fit.slope! * bytes);
      if (bytes >= fit.minBytes && bytes <= fit.maxBytes)
        return { ms, tag: `interpolated · ${fit.n} runs` };
      const f = bytes > fit.maxBytes ? bytes / fit.maxBytes : fit.minBytes / bytes;
      if (fit.n >= EXTRAP_MIN_N && f <= MAX_EXTRAP)
        return { ms, tag: `extrapolated ${fmtX(f)} · ${fit.n} runs` };
      // too few points or too far past the data to trust — use the model below
    }
    // No usable slope (overhead-dominated / single size cluster) — trust the
    // measured average only near where it was actually measured.
    const near = bytes >= fit.minBytes / SIZE_BAND && bytes <= fit.maxBytes * SIZE_BAND;
    if (near) return { ms: fit.avgMs, tag: `avg · ${fit.n} run${fit.n === 1 ? "" : "s"}` };
  }
  // Fallback — the hardcoded baseline model. Always sensible, clearly labeled
  // "modeled" so it's never mistaken for measured data.
  return { ms: projectMs(BACKENDS[id], bytes), tag: "modeled" };
}
function fmtX(f: number) {
  if (f >= 1000) return `×${Math.round(f / 1000)}k`;
  if (f >= 10) return `×${Math.round(f)}`;
  return `×${f.toFixed(1)}`;
}

export default function Arena() {
  const [mode, setMode] = useState<"live" | "sim">("live");
  const [simBytes, setSimBytes] = useState(1024 * 1024); // 1 MB default
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [lanes, setLanes] = useState<Record<BackendId, Lane>>(idleLanes);
  const [fits, setFits] = useState<Partial<Record<BackendId, Fit>>>({});
  const [, setTick] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [modal, setModal] = useState(false);
  const [polling, setPolling] = useState(false); // a background Tapedrive job is running
  const runGen = useRef(0); // invalidates stale polls when a new run starts

  // Load each network's ms-vs-bytes fit over all recorded runs. Size-independent
  // (we evaluate it at the slider size on the client), so we load once on mount
  // and again after each live upload, as new runs sharpen the fit.
  async function loadFits() {
    try {
      const r = await fetch("/api/fits");
      const j = await r.json();
      const map: Partial<Record<BackendId, Fit>> = {};
      for (const f of j.fits ?? [])
        map[f.backend as BackendId] = {
          slope: f.slope,
          intercept: f.intercept,
          n: f.n,
          minBytes: f.minBytes,
          maxBytes: f.maxBytes,
          avgMs: f.avgMs,
        };
      setFits(map);
    } catch {}
  }
  useEffect(() => {
    loadFits();
  }, []);

  // Any lane still in flight — drives the ticker and the disabled state. A
  // simulation runs at TRUE 1:1 wall-clock, so a slow lane can stay "running"
  // for a very long time; we key off the lanes themselves, not a boolean.
  const anyRunning = BACKEND_ORDER.some((id) => lanes[id].status === "running");
  const busy = running || polling || anyRunning;

  // animate while ANY lane is still moving (or a Tapedrive job is polling)
  useEffect(() => {
    if (!busy) return;
    let raf = 0;
    const loop = () => {
      setTick((t) => t + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [busy]);

  // poll a background Tapedrive write until it finishes
  function pollTape(id: BackendId, jobId: string, gen: number) {
    const tick = async () => {
      if (gen !== runGen.current) return; // a newer run started
      try {
        const r = await fetch(`/api/upload/status?jobId=${jobId}`);
        const j = await r.json();
        if (gen !== runGen.current) return;
        if (j.status === "done") {
          setLanes((p) => ({
            ...p,
            [id]: { ...p[id], status: "done", reportedMs: j.ms, live: true, readUrl: j.blobUrl, blobId: j.blobId, segments: j.segments },
          }));
          setPolling(false);
          loadFits(); // Tapedrive's just-finished write now sharpens its fit
          return;
        }
        if (j.status === "failed" || j.status === "unknown") {
          setLanes((p) => ({ ...p, [id]: { ...p[id], status: "error", error: j.error || "failed" } }));
          setPolling(false);
          return;
        }
        setTimeout(tick, 2500);
      } catch {
        setTimeout(tick, 3500);
      }
    };
    setTimeout(tick, 2500);
  }

  function startLanes(targets: Record<BackendId, number>) {
    const now = Date.now();
    const fresh = idleLanes();
    BACKEND_ORDER.forEach(
      (id) =>
        (fresh[id] = { status: "running", startedAt: now, targetWall: targets[id] })
    );
    setLanes(fresh);
  }

  async function runLive() {
    if (!file || busy) return;
    runGen.current++;
    const gen = runGen.current;
    setPolling(false);
    setRunning(true);
    const size = file.size;
    // Uncapped — the bar paces against the real projected duration and snaps
    // to the actual elapsed time when each upload truly lands.
    const targets = Object.fromEntries(
      BACKEND_ORDER.map((id) => [id, projectMs(BACKENDS[id], size)])
    ) as Record<BackendId, number>;
    startLanes(targets);

    await Promise.all(
      BACKEND_ORDER.map(async (id) => {
        try {
          const res = await fetch(`/api/upload?backend=${id}`, {
            method: "POST",
            body: file,
            headers: {
              "content-type": file.type || "application/octet-stream",
              "x-filename": encodeURIComponent(file.name),
            },
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || `http ${res.status}`);
          // Tapedrive: write is running in the background — switch the lane to
          // its real (uncapped) projected duration and poll until it lands.
          if (json.pending) {
            setLanes((p) => ({
              ...p,
              [id]: {
                ...p[id],
                status: "running",
                startedAt: Date.now(),
                targetWall: json.projected || p[id].targetWall,
                segments: json.segments ?? null,
                bytes: size,
              },
            }));
            setPolling(true);
            pollTape(id, json.jobId, gen);
            return;
          }
          setLanes((p) => ({
            ...p,
            [id]: {
              ...p[id],
              status: "done",
              reportedMs: json.ms,
              live: json.live,
              fellBack: json.fellBack,
              note: json.note,
              readUrl: json.blobUrl,
              blobId: json.blobId ?? null,
              segments: json.segments ?? null,
              bytes: size,
            },
          }));
        } catch (e: any) {
          setLanes((p) => ({
            ...p,
            [id]: { ...p[id], status: "error", error: e?.message ?? "failed" },
          }));
        }
      })
    );
    setRunning(false);
    loadFits(); // the runs we just recorded now sharpen the fits
  }

  async function runSim() {
    if (busy) return;
    runGen.current++;
    const gen = runGen.current;
    setPolling(false);
    setRunning(false);

    // The simulation IS the crowd data, extrapolated: each lane replays its
    // network's linear fit (over real recorded runs) evaluated at this size.
    // Fetch fresh so it reflects every upload so far. Plays at TRUE 1:1
    // wall-clock — nothing faked; the number is derived from measured runs and
    // labeled (interpolated / extrapolated ×N). A network without enough size
    // spread to extrapolate honestly shows nothing rather than a wrong number.
    let freshFits: Partial<Record<BackendId, Fit>> = {};
    try {
      const r = await fetch("/api/fits");
      const j = await r.json();
      for (const f of j.fits ?? [])
        freshFits[f.backend as BackendId] = {
          slope: f.slope,
          intercept: f.intercept,
          n: f.n,
          minBytes: f.minBytes,
          maxBytes: f.maxBytes,
          avgMs: f.avgMs,
        };
    } catch {}
    if (gen !== runGen.current) return; // reset/newer run during the fetch
    setFits(freshFits);

    const preds = Object.fromEntries(
      BACKEND_ORDER.map((id) => [id, predictSim(freshFits[id], simBytes, id)])
    ) as Record<BackendId, { ms: number; tag: string }>;

    const now = Date.now();
    const fresh = idleLanes();
    BACKEND_ORDER.forEach((id) => {
      const p = preds[id]; // never null — predictSim always returns an estimate
      fresh[id] = {
        status: "running",
        startedAt: now,
        targetWall: p.ms,
        sim: true,
        simTag: p.tag,
        count: freshFits[id]?.n ?? 0,
        bytes: simBytes,
      };
    });
    setLanes(fresh);

    // Each lane finishes exactly when its predicted time elapses — real time.
    BACKEND_ORDER.forEach((id) => {
      const p = preds[id];
      if (p.ms > MAX_TIMEOUT) return;
      setTimeout(() => {
        if (gen !== runGen.current) return; // a newer run / reset superseded this
        setLanes((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            status: "done",
            reportedMs: p.ms,
            sim: true,
            count: freshFits[id]?.n ?? 0,
            bytes: simBytes,
            simTag: p.tag,
            segments: segmentCount(BACKENDS[id], simBytes),
          },
        }));
      }, p.ms);
    });
  }

  function reset() {
    runGen.current++; // invalidates any in-flight sim timers and Tapedrive polls
    setPolling(false);
    setRunning(false);
    setFile(null);
    setLanes(idleLanes());
  }

  const fileSize = file?.size ?? 0;
  // Total runs feeding the fits + the measured size range — drives the honest
  // "fit from N runs measured X–Y" readout under the slider.
  const fitRuns = BACKEND_ORDER.reduce((s, id) => s + (fits[id]?.n ?? 0), 0);
  const fitSizes = BACKEND_ORDER.flatMap((id) =>
    fits[id]?.n ? [fits[id]!.minBytes, fits[id]!.maxBytes] : []
  );
  const fitMin = fitSizes.length ? Math.min(...fitSizes) : 0;
  const fitMax = fitSizes.length ? Math.max(...fitSizes) : 0;
  const doneMs = BACKEND_ORDER.map((id) => lanes[id])
    .filter((l) => l.status === "done" && l.reportedMs != null)
    .map((l) => l.reportedMs!);
  const fastest = doneMs.length ? Math.min(...doneMs) : null;

  return (
    <div>
      {/* mode toggle */}
      <div className="mb-5 inline-flex rounded-lg border border-line p-0.5 text-sm">
        {(["live", "sim"] as const).map((m) => (
          <button
            key={m}
            onClick={() => !busy && setMode(m)}
            disabled={busy}
            className={`rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 ${
              mode === m ? "bg-ink text-bg" : "text-muted hover:text-ink"
            }`}
          >
            {m === "live" ? "Live upload" : "Simulation"}
          </button>
        ))}
      </div>

      {/* controls */}
      {mode === "live" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          className={`rounded-lg border px-4 py-3 transition-colors ${
            dragOver ? "border-ink/40 bg-ink/[0.04]" : "border-line bg-bg"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <label className="inline-flex w-fit shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-ink/30">
              <Upload size={15} />
              Choose file
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="min-w-0 truncate text-sm text-muted">
              {file ? (
                <>
                  <span className="text-ink">{file.name}</span> · {fmtBytes(fileSize)}
                </>
              ) : (
                "Drop a file here to send it to every network at once."
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
              <button
                onClick={runLive}
                disabled={!file || busy}
                className="whitespace-nowrap rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-30"
              >
                {busy ? "Running…" : "Enter the arena"}
              </button>
              <button
                onClick={reset}
                className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                Reset
              </button>
            </div>
          </div>
          {/* honest size note — no hard cap, but big files strain some networks */}
          <div className="mt-2.5 text-[11px] text-muted">
            No size limit — but files over ~10&nbsp;MB may fail on some networks.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-bg px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted">
              Extrapolates each network&apos;s recorded runs to{" "}
              <span className="tnum font-mono text-ink">{fmtSize(simBytes)}</span>,
              replayed in real time.
            </div>
            <button
              onClick={busy ? reset : runSim}
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg"
            >
              {busy ? <Close size={14} /> : <Play size={14} />}
              {busy ? "Stop" : "Run simulation"}
            </button>
          </div>
          {/* log-scaled size slider — 1 KB to 10 GB */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={bytesToSlider(simBytes)}
            onChange={(e) => !busy && setSimBytes(sliderToBytes(Number(e.target.value)))}
            disabled={busy}
            className="arena-slider w-full"
            aria-label="Simulated file size"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {SIM_PRESETS.map((p) => {
              const active = Math.abs(simBytes - p.bytes) / p.bytes < 0.02;
              return (
                <button
                  key={p.label}
                  onClick={() => !busy && setSimBytes(p.bytes)}
                  disabled={busy}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
                    active
                      ? "border-ink/40 bg-ink/[0.04] text-ink"
                      : "border-line text-muted hover:border-ink/30 hover:text-ink"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {/* honest data-availability readout — the sim is only as good as the
              runs recorded near this size */}
          <div className="text-[11px] text-muted">
            {fitRuns > 0 ? (
              <>
                Fit from <span className="text-ink">{fitRuns}</span> recorded run
                {fitRuns === 1 ? "" : "s"}, measured {fmtSize(fitMin)}–{fmtSize(fitMax)}.
                Beyond that range is extrapolated.
              </>
            ) : (
              "No runs recorded yet — run a live upload to seed the fit."
            )}
          </div>
        </div>
      )}

      {/* phase legend — color = kind of step, shared across all networks */}
      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
        <span className="uppercase tracking-widest text-muted">Phases</span>
        {PHASES.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5" title={p.desc}>
            <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: p.color }} />
            <span className="text-ink">{p.label}</span>
          </span>
        ))}
      </div>

      {/* lanes — each network is its own off-white panel inside the white card */}
      <div className="mt-3 space-y-2.5">
        {BACKEND_ORDER.map((id) => (
          <LaneView key={id} backend={BACKENDS[id]} lane={lanes[id]} fastest={fastest} />
        ))}
      </div>

      {/* request a contestant */}
      <button
        onClick={() => setModal(true)}
        className="mt-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-line px-4 py-4 text-left text-sm text-muted transition-colors hover:border-ink/30 hover:text-ink"
      >
        <Plus size={16} />
        Request a contestant
        <span className="ml-auto text-xs text-muted">
          a network you want to see in the arena
        </span>
      </button>

      {modal && <RequestModal onClose={() => setModal(false)} />}
    </div>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closing = useRef(false);

  // anime.js: dialog scales + slides in; backdrop fades
  useEffect(() => {
    if (backdropRef.current)
      animate(backdropRef.current, { opacity: [0, 1], duration: 200, ease: "outQuad" });
    if (dialogRef.current)
      animate(dialogRef.current, {
        opacity: [0, 1],
        scale: [0.92, 1],
        translateY: [16, 0],
        duration: 440,
        ease: "outExpo",
      });
  }, []);

  function close() {
    if (closing.current) return;
    closing.current = true;
    if (backdropRef.current)
      animate(backdropRef.current, { opacity: [1, 0], duration: 200, ease: "inQuad" });
    if (dialogRef.current) {
      animate(dialogRef.current, {
        opacity: [1, 0],
        scale: [1, 0.96],
        translateY: [0, 10],
        duration: 200,
        ease: "inQuad",
        onComplete: onClose,
      });
    } else {
      onClose();
    }
  }

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), note: note.trim() || undefined }),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4"
      style={{ opacity: 0 }}
      onClick={close}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border border-line bg-bg p-5"
        style={{ opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Request a contestant</h2>
          <button onClick={close} className="text-muted hover:text-ink" title="close">
            <Close size={16} />
          </button>
        </div>
        {sent ? (
          <div className="py-4 text-sm text-muted">
            Noted — <span className="text-ink">{name}</span> is on the list. Thanks.
          </div>
        ) : (
          <>
            <p className="mb-3 text-[13px] leading-relaxed text-muted">
              A storage network you&apos;d want to see go up against the others
              — Arweave, Filecoin, a CDN, anything.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Network name"
              className="mb-2 w-full rounded-md border border-line bg-white/60 px-3 py-2 text-sm outline-none focus:border-ink/40"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why? (optional)"
              className="mb-4 w-full rounded-md border border-line bg-white/60 px-3 py-2 text-sm outline-none focus:border-ink/40"
            />
            <button
              onClick={submit}
              disabled={!name.trim() || busy}
              className="w-full rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg disabled:opacity-30"
            >
              {busy ? "Sending…" : "Submit request"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
