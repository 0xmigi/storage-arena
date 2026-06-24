import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { BACKENDS, BackendId, projectMs, segmentCount } from "@/lib/backends";
import { recordRun } from "@/lib/run-store";
import { createJob, getJob, updateJob } from "@/lib/tape-jobs";

export const runtime = "nodejs";
export const maxDuration = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap
const DEMO_CAP_MS = 9000; // how long a modeled lane visibly blocks

const WALRUS_PUBLISHER =
  process.env.WALRUS_PUBLISHER ?? "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR =
  process.env.WALRUS_AGGREGATOR ?? "https://aggregator.walrus-testnet.walrus.space";

interface Result {
  ms: number;
  live: boolean;
  blobId?: string | null;
  blobUrl?: string | null;
  segments?: number | null;
  note?: string;
  fellBack?: boolean;
  pending?: boolean; // Tapedrive: write running in the background
  jobId?: string;
  projected?: number;
}

async function doWalrus(bytes: Uint8Array): Promise<Result> {
  const started = Date.now();
  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=1`, {
    method: "PUT",
    body: bytes,
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`walrus ${res.status}`);
  const json: any = await res.json();
  const info = json.newlyCreated?.blobObject ?? json.alreadyCertified;
  const blobId: string | null = info?.blobId ?? null;
  return {
    ms: Date.now() - started,
    live: true,
    blobId,
    // Serve via our route so the browser gets a real Content-Type and renders
    // the image (the raw aggregator URL returns octet-stream).
    blobUrl: blobId ? `/api/blob/walrus/${blobId}` : null,
  };
}

async function doTapedrive(bytes: Uint8Array): Promise<Result> {
  const bin = process.env.TAPEDRIVE_BIN;
  const keypair = process.env.TAPEDRIVE_KEYPAIR;
  const projected = projectMs(BACKENDS.tapedrive, bytes.length);
  const segments = segmentCount(BACKENDS.tapedrive, bytes.length);

  if (!bin || !keypair) {
    await sleep(Math.min(projected, DEMO_CAP_MS));
    return { ms: projected, live: false, segments, note: "CLI not configured" };
  }

  // A real photo is ~hundreds of transactions / minutes of work, so we DON'T
  // wait for it. Spawn the write in the background, return a jobId immediately,
  // and let the client poll /api/upload/status until it finishes.
  const tmp = join(tmpdir(), `race-${randomUUID()}`);
  await writeFile(tmp, bytes);
  // The tape PDA is derived from (authority, name) → name must be unique.
  const tapeName = `race-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const jobId = randomUUID();
  createJob({
    jobId,
    status: "running",
    bytes: bytes.length,
    segments,
    projectedMs: projected,
    startedAt: Date.now(),
  });

  const child = spawn(bin, ["-k", keypair, "-u", "d", "write", tmp, "-y", "-n", tapeName]);
  let out = "";
  child.stdout.on("data", (d) => (out += d.toString()));
  child.stderr.on("data", (d) => (out += d.toString()));
  child.on("error", (e) => updateJob(jobId, { status: "failed", error: e.message }));
  child.on("close", async (code) => {
    unlink(tmp).catch(() => {});
    const addr =
      out.match(/tapedrive read\s+([1-9A-HJ-NP-Za-km-z]{32,44})/)?.[1] ??
      out.match(/Tape Address:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/)?.[1] ??
      null;
    const started = getJob(jobId)?.startedAt ?? Date.now();
    const ms = Date.now() - started;
    if (code === 0 && addr) {
      updateJob(jobId, { status: "done", ms, tapeAddr: addr });
      await recordRun({
        backend: "tapedrive",
        bytes: bytes.length,
        ms,
        live: true,
        blobId: addr,
        blobUrl: `/api/blob/tapedrive/${addr}`,
      });
    } else {
      updateJob(jobId, { status: "failed", error: `write failed (exit ${code ?? "?"})` });
    }
  });

  return { ms: 0, live: false, segments, pending: true, jobId, projected };
}

async function doR2(bytes: Uint8Array, name: string, contentType: string): Promise<Result> {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE } =
    process.env;
  const projected = projectMs(BACKENDS.s3, bytes.length);
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    await sleep(Math.min(projected, DEMO_CAP_MS));
    return { ms: projected, live: false, note: "R2 not configured" };
  }
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  const key = `race/${Date.now()}-${randomUUID().slice(0, 8)}-${name}`;
  const started = Date.now();
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    })
  );
  return {
    ms: Date.now() - started,
    live: true,
    blobId: key,
    blobUrl: R2_PUBLIC_BASE ? `${R2_PUBLIC_BASE}/${key}` : null,
  };
}

async function doIpfs(bytes: Uint8Array, name: string, contentType: string): Promise<Result> {
  const jwt = process.env.PINATA_JWT;
  const gateway = process.env.IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs";
  const projected = projectMs(BACKENDS.ipfs, bytes.length);
  if (!jwt) {
    await sleep(Math.min(projected, DEMO_CAP_MS));
    return { ms: projected, live: false, note: "Pinata not configured" };
  }
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }), name);
  const started = Date.now();
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`pinata ${res.status}`);
  const json: any = await res.json();
  const cid: string | null = json.IpfsHash ?? null;
  return {
    ms: Date.now() - started,
    live: true,
    blobId: cid,
    blobUrl: cid ? `${gateway}/${cid}` : null,
  };
}

export async function POST(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("backend") ?? "") as BackendId;
  const backend = BACKENDS[id];
  if (!backend) return NextResponse.json({ error: "unknown backend" }, { status: 400 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "file exceeds 2 MB cap" }, { status: 413 });
  }
  const rawName = req.headers.get("x-filename") ?? "upload.bin";
  let decodedName = "upload.bin";
  try {
    decodedName = decodeURIComponent(rawName);
  } catch {
    decodedName = rawName;
  }
  const name = decodedName.replace(/[^\w.\-]/g, "_");
  const contentType = req.headers.get("content-type") || "application/octet-stream";

  let r: Result;
  try {
    if (id === "walrus") r = await doWalrus(bytes);
    else if (id === "tapedrive") r = await doTapedrive(bytes);
    else if (id === "s3") r = await doR2(bytes, name, contentType);
    else r = await doIpfs(bytes, name, contentType);
  } catch (e: any) {
    // Real attempt failed — fall back to a modeled time so the race still completes.
    const projected = projectMs(backend, bytes.length);
    await sleep(Math.min(projected, DEMO_CAP_MS));
    r = {
      ms: projected,
      live: false,
      fellBack: true,
      note: `${id} live failed (${e?.message ?? "error"})`,
      segments: segmentCount(backend, bytes.length),
    };
  }

  // Tapedrive runs in the background — the run is recorded when the job
  // finishes (in the spawn close handler), not here.
  if (r.pending) {
    return NextResponse.json({ backend: id, ok: true, ...r });
  }

  // Record every run (real ones feed the crowd averages).
  await recordRun({
    backend: id,
    bytes: bytes.length,
    ms: r.ms,
    live: r.live,
    blobId: r.blobId ?? null,
    blobUrl: r.blobUrl ?? null,
  });

  return NextResponse.json({ backend: id, ok: true, ...r });
}
