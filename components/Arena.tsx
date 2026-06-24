"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { BACKENDS, BACKEND_ORDER, BackendId, projectMs, PHASES } from "@/lib/backends";
import { Close, Play, Plus, Upload } from "./Icons";
import { Lane as LaneView } from "./Lane";

const CAP_MS = 9000; // visual cap so slow lanes still resolve on screen
const SIM_SIZE = 500_000; // nominal size for modeled fallback in simulation

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
  segments?: number | null;
  error?: string;
}
type Avg = { avgMs: number; count: number };

const idleLanes = () =>
  Object.fromEntries(
    BACKEND_ORDER.map((id) => [id, { status: "idle" } as Lane])
  ) as Record<BackendId, Lane>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function Arena() {
  const [mode, setMode] = useState<"live" | "sim">("live");
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [lanes, setLanes] = useState<Record<BackendId, Lane>>(idleLanes);
  const [averages, setAverages] = useState<Partial<Record<BackendId, Avg>>>({});
  const [, setTick] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [modal, setModal] = useState(false);
  const [polling, setPolling] = useState(false); // a background Tapedrive job is running
  const runGen = useRef(0); // invalidates stale polls when a new run starts

  async function loadAverages() {
    try {
      const r = await fetch("/api/averages");
      const j = await r.json();
      const map: Partial<Record<BackendId, Avg>> = {};
      for (const a of j.averages ?? [])
        map[a.backend as BackendId] = { avgMs: a.avgMs, count: a.count };
      setAverages(map);
    } catch {}
  }
  useEffect(() => {
    loadAverages();
  }, []);

  // animate while a race is running OR a background Tapedrive job is polling
  useEffect(() => {
    if (!running && !polling) return;
    let raf = 0;
    const loop = () => {
      setTick((t) => t + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, polling]);

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
            [id]: { ...p[id], status: "done", reportedMs: j.ms, live: true, readUrl: j.blobUrl, segments: j.segments },
          }));
          setPolling(false);
          loadAverages();
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
    if (!file || running) return;
    runGen.current++;
    const gen = runGen.current;
    setPolling(false);
    setRunning(true);
    const size = file.size;
    const targets = Object.fromEntries(
      BACKEND_ORDER.map((id) => [id, Math.min(projectMs(BACKENDS[id], size), CAP_MS)])
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
              segments: json.segments ?? null,
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
    loadAverages();
  }

  async function runSim() {
    if (running) return;
    runGen.current++;
    setPolling(false);
    setRunning(true);
    const real = (id: BackendId) =>
      averages[id]?.avgMs ?? projectMs(BACKENDS[id], SIM_SIZE);
    const targets = Object.fromEntries(
      BACKEND_ORDER.map((id) => [id, Math.min(real(id), CAP_MS)])
    ) as Record<BackendId, number>;
    startLanes(targets);

    await Promise.all(
      BACKEND_ORDER.map(async (id) => {
        await sleep(targets[id]);
        setLanes((p) => ({
          ...p,
          [id]: {
            ...p[id],
            status: "done",
            reportedMs: real(id),
            sim: true,
            count: averages[id]?.count ?? 0,
          },
        }));
      })
    );
    setRunning(false);
  }

  function reset() {
    runGen.current++;
    setPolling(false);
    setFile(null);
    setLanes(idleLanes());
  }

  const fileSize = file?.size ?? 0;
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
            onClick={() => !running && setMode(m)}
            disabled={running}
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
          className={`flex flex-col gap-3 rounded-lg border px-4 py-3 transition-colors sm:flex-row sm:items-center sm:gap-4 ${
            dragOver ? "border-ink/40 bg-ink/[0.02]" : "border-line"
          }`}
        >
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-line bg-white/60 px-3 py-1.5 text-sm hover:border-ink/30">
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
              "Drop a file here to send it to all four at once."
            )}
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={runLive}
              disabled={!file || running}
              className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-30"
            >
              {running ? "Running…" : "Enter the arena"}
            </button>
            <button
              onClick={reset}
              disabled={running}
              className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-30"
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-line px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="text-sm text-muted">
            Replays the{" "}
            <span className="text-ink">average of every real run</span> — no
            upload needed.
          </div>
          <div className="sm:ml-auto">
            <button
              onClick={runSim}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-30"
            >
              <Play size={14} />
              {running ? "Running…" : "Run simulation"}
            </button>
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

      {/* lanes */}
      <div className="mt-3 border-t border-line">
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
