// Central definition of the four storage backends we compare.
// `mode: "live"` means a real upload happens; `mode: "modeled"` means we
// simulate a realistic latency curve (swappable to a real adapter later).

export type BackendId = "tapedrive" | "walrus" | "ipfs" | "s3";

// A single step in a backend's write process. `weight` drives both the
// segment width in the bar and its share of the animated time. `icon` keys a
// small concrete visual; `why` is the plain, vivid explanation.
export interface Stage {
  key: string;
  label: string;
  icon: string;
  why: string;
  weight: number;
  scalesWithSize?: boolean;
}

// Where a backend's real artifact lands, and how to back-reference it on its
// home chain. `stageKey` ties the receipt to the stage where it's created, so
// opening that definition reveals the actual thing that happened.
export interface Receipt {
  stageKey: string;
  chain: string; // "Solana devnet", "Sui testnet", "IPFS network", "Cloudflare R2"
  verb: string; // what the id IS — "Tape account", "Blob", "CID", "Object key"
  explorer?: (id: string) => string; // build a chain-explorer URL; omit for S3
}

export interface Backend {
  id: BackendId;
  name: string;
  blurb: string;
  logo: string; // favicon URL (Google's favicon service)
  accent: string;
  mode: "live" | "modeled";
  decentralized: boolean;
  costModel: string;
  permanence: string;
  readSpeed: string;
  writeModel: string;
  success: string; // what counts as a "successful upload"
  receipt: Receipt;
  stages: Stage[];
  baseMs: number;
  throughputMBs: number;
  segmentBytes?: number;
  msPerSegment?: number;
}

export const BACKENDS: Record<BackendId, Backend> = {
  tapedrive: {
    id: "tapedrive",
    name: "Tapedrive",
    blurb: "Solana-native object storage. Pay once, erasure-coded.",
    logo: "https://www.google.com/s2/favicons?domain=tapedrive.io&sz=64",
    accent: "#9945FF",
    mode: "modeled",
    decentralized: true,
    costModel: "Prepaid in TAPE (storage price × size × epoch term)",
    permanence: "Fixed epoch term (renewable)",
    readSpeed: "Fast (gateway HTTP, slice-cached)",
    writeModel: "Erasure-code → ship shards to node group → commit on Solana",
    success: "The tape's commitment is finalized on Solana, and a staked node group holds the erasure-coded data.",
    // Live-data hook (when mainnet): the Tapedrive Explorer by Spool Labs is the
    // walruscan-equivalent — pull node count, certification events, and stored-
    // object stats from it to replace the "modeled" cells here and in comparison.ts.
    // Devnet-only today (~20 staked nodes, epoch committees); preview host
    // http://138.197.117.220 (Objects / Events / Accounts / Nodes) will move to a
    // real domain at launch. Until then, keep Tapedrive's cells as pre-launch.
    receipt: {
      stageKey: "commit",
      chain: "Solana devnet",
      verb: "Tape account",
      explorer: (a) => `https://explorer.solana.com/address/${a}?cluster=devnet`,
    },
    baseMs: 1400,
    throughputMBs: 6,
    stages: [
      {
        key: "code",
        label: "Erasure-code",
        icon: "shards",
        why: "Your file is split into ≤64 MB tracks, each Clay-coded into 20 shards (10 data + 10 parity) — so any 10 of the 20 can rebuild it. Small files get light coding; large files get full redundancy.",
        weight: 1.5,
      },
      {
        key: "ship",
        label: "Upload shards",
        icon: "distribute",
        why: "The 20 shards are sent over HTTP, in parallel, to the 20 nodes of the assigned storage group. This is the bandwidth-bound part — and the bytes never touch the Solana ledger.",
        weight: 2.5,
        scalesWithSize: true,
      },
      {
        key: "commit",
        label: "Commit on Solana",
        icon: "anchor",
        why: "A tiny (~10 KB) commitment per track — a merkle root plus the 20 shard hashes — is written to the tape account on Solana. The chain records what's stored and where, not the bytes.",
        weight: 1,
      },
      {
        key: "certify",
        label: "Certify",
        icon: "certificate",
        why: "Each epoch, at least 14 of the group's 20 nodes BLS-sign that they're holding their shard. That one aggregated signature, posted on-chain, is the proof the data is stored.",
        weight: 1,
      },
    ],
  },
  walrus: {
    id: "walrus",
    name: "Walrus",
    blurb: "Erasure-coded blob storage on Sui. Fast write, decentralized.",
    logo: "https://www.google.com/s2/favicons?domain=walrus.xyz&sz=64",
    accent: "#00C2FF",
    mode: "live",
    decentralized: true,
    costModel: "Pay per blob + storage epochs (WAL)",
    permanence: "Epoch-based (renewable)",
    readSpeed: "Fast (aggregator HTTP)",
    writeModel: "HTTP to publisher → erasure-coded to storage nodes",
    success: "An availability certificate is issued on Sui — a quorum of nodes has acknowledged holding their slivers.",
    receipt: {
      stageKey: "register",
      chain: "Sui testnet",
      verb: "Blob",
      explorer: (id) => `https://walruscan.com/testnet/blob/${id}`,
    },
    baseMs: 600,
    throughputMBs: 8,
    stages: [
      {
        key: "encode",
        label: "Erasure-code",
        icon: "shards",
        why: "The blob is shredded into many overlapping 'slivers' with built-in redundancy — so the original can be rebuilt even if a large fraction of nodes disappear.",
        weight: 1.5,
      },
      {
        key: "distribute",
        label: "Distribute",
        icon: "distribute",
        why: "The slivers are scattered across independent storage nodes in parallel, over plain HTTP. The bulk data never touches a blockchain.",
        weight: 2.5,
        scalesWithSize: true,
      },
      {
        key: "register",
        label: "Certify on Sui",
        icon: "certificate",
        why: "Once enough nodes confirm they're holding their sliver, a certificate is stamped on Sui — that certificate is the proof the blob exists and is available.",
        weight: 1,
      },
    ],
  },
  ipfs: {
    id: "ipfs",
    name: "IPFS",
    blurb: "Content-addressed P2P storage. Durable only while pinned.",
    logo: "https://www.google.com/s2/favicons?domain=ipfs.tech&sz=64",
    accent: "#65C2CB",
    mode: "modeled",
    decentralized: true,
    costModel: "Free to add · pinning is recurring ($/GB/mo)",
    permanence: "Only while pinned (else garbage-collected)",
    readSpeed: "Gateway-variable (cache hit vs DHT lookup)",
    writeModel: "Local add → CID; pin to keep alive",
    success: "A CID exists and at least one node is pinning it — IPFS alone guarantees addressing, not persistence.",
    receipt: {
      stageKey: "announce",
      chain: "IPFS network",
      verb: "CID",
      explorer: (cid) => `https://cid.ipfs.tech/#${cid}`,
    },
    baseMs: 150,
    throughputMBs: 15,
    stages: [
      {
        key: "cid",
        label: "Hash → CID",
        icon: "fingerprint",
        why: "The file is chunked and hashed into a CID — an address derived from the content itself, so identical bytes always get the exact same name.",
        weight: 1.5,
        scalesWithSize: true,
      },
      {
        key: "add",
        label: "Add to node",
        icon: "drive",
        why: "The chunks are written into a node's local repository — fast, because it's just a local disk write.",
        weight: 1.5,
      },
      {
        key: "announce",
        label: "Announce / pin",
        icon: "broadcast",
        why: "The node tells the network 'I have this CID,' and you 'pin' it so it isn't garbage-collected. No pin, no guarantee it survives.",
        weight: 1.5,
      },
    ],
  },
  s3: {
    id: "s3",
    name: "AWS S3",
    blurb: "Centralized object storage. The fast, paid baseline.",
    logo: "https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64",
    accent: "#FF9900",
    mode: "modeled",
    decentralized: false,
    costModel: "Recurring $/GB/month + egress",
    permanence: "Until you delete it (or stop paying)",
    readSpeed: "Fast (CDN-frontable)",
    writeModel: "Single HTTPS PUT to a bucket",
    success: "One company returns HTTP 200 — you trust their internal replication for durability.",
    receipt: {
      stageKey: "replicate",
      chain: "Cloudflare R2",
      verb: "Object key",
      // No public ledger — the proof is the HTTP 200 and the object URL itself.
    },
    baseMs: 90,
    throughputMBs: 25,
    stages: [
      {
        key: "put",
        label: "HTTPS PUT",
        icon: "upload",
        why: "The whole object is streamed to the bucket in a single authenticated HTTPS request — one round trip, and it's stored.",
        weight: 2.5,
        scalesWithSize: true,
      },
      {
        key: "replicate",
        label: "Replicate",
        icon: "copies",
        why: "Behind the scenes the provider copies it across multiple data centers for durability — invisible to you, and the reason for their '11 nines' claim.",
        weight: 1,
      },
    ],
  },
};

export const BACKEND_ORDER: BackendId[] = ["tapedrive", "walrus", "ipfs", "s3"];

export function projectMs(b: Backend, bytes: number): number {
  const transfer = (bytes / (b.throughputMBs * 1_000_000)) * 1000;
  let segmentPenalty = 0;
  if (b.segmentBytes && b.msPerSegment) {
    const segments = Math.ceil(bytes / b.segmentBytes);
    segmentPenalty = segments * b.msPerSegment;
  }
  return Math.round(b.baseMs + transfer + segmentPenalty);
}

export function segmentCount(b: Backend, bytes: number): number | null {
  if (!b.segmentBytes) return null;
  return Math.ceil(bytes / b.segmentBytes);
}

// Color by PROCESS PHASE, not by network — so the same kind of step is the
// same color across all four. Every upload, however different, does some of:
// prepare the data, transmit the bytes, commit it durably.
export type Phase = "prepare" | "transmit" | "commit";
export const PHASES: { key: Phase; label: string; color: string; desc: string }[] = [
  {
    key: "prepare",
    label: "Prepare",
    color: "#2f62ea",
    desc: "Transform the file into a storable form — chunk, hash, or erasure-code it.",
  },
  {
    key: "transmit",
    label: "Transmit",
    color: "#8a2be2",
    desc: "Move the actual bytes to wherever they'll live.",
  },
  {
    key: "commit",
    label: "Commit",
    color: "#f26a1b",
    desc: "Make it durable and official — the moment the upload truly counts.",
  },
];
const STAGE_PHASE: Record<string, Phase> = {
  code: "prepare",
  ship: "transmit",
  commit: "commit",
  certify: "commit",
  encode: "prepare",
  distribute: "transmit",
  register: "commit",
  cid: "prepare",
  add: "transmit",
  announce: "commit",
  put: "transmit",
  replicate: "commit",
};
export function phaseOf(stageKey: string): Phase {
  return STAGE_PHASE[stageKey] ?? "transmit";
}
export function phaseColor(stageKey: string): string {
  const p = phaseOf(stageKey);
  return PHASES.find((x) => x.key === p)?.color ?? "#999999";
}

export interface StageRange extends Stage {
  start: number;
  end: number;
}
export function stageRanges(stages: Stage[]): StageRange[] {
  const total = stages.reduce((s, x) => s + x.weight, 0);
  let acc = 0;
  return stages.map((s) => {
    const start = acc / total;
    acc += s.weight;
    return { ...s, start, end: acc / total };
  });
}
