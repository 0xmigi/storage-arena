import { BACKENDS } from "./backends";

// Qualitative comparison — what each network GIVES you, separate from speed.
// Each cell is TWO lines: line 0 = a couple-word headline (scannable, dark),
// line 1 = an informative one-liner that summarizes the nuance (fine print).
// Concrete: named tech + real $. Tapedrive being pre-launch is flagged once via
// a badge on its column, so its cells state the designed facts.
// Buyer-first order: Cost leads, Decentralization is last.
// Networks are decoupled from the live-upload backends so comparison-only
// entries (Shelby, Arweave) can be added without an upload adapter.

export interface CompareNet {
  id: string;
  name: string;
  logo: string;
  badge?: string; // small status flag by the header (e.g. "pre-launch")
}

export const COMPARE_NETS: CompareNet[] = [
  { id: "tapedrive", name: BACKENDS.tapedrive.name, logo: BACKENDS.tapedrive.logo, badge: "pre-launch" },
  { id: "walrus", name: BACKENDS.walrus.name, logo: BACKENDS.walrus.logo },
  { id: "ipfs", name: BACKENDS.ipfs.name, logo: BACKENDS.ipfs.logo },
  { id: "s3", name: BACKENDS.s3.name, logo: BACKENDS.s3.logo },
  // To add Shelby: { id: "shelby", name: "Shelby", logo: "..." } + a cell per section below.
];

export interface CompareSection {
  key: string;
  title: string;
  cells: Record<string, string[]>; // keyed by net id; line 0 = headline fact
}

export const COMPARE: CompareSection[] = [
  {
    key: "cost",
    title: "Cost",
    cells: {
      tapedrive: ["Pay once", "One upfront payment in TAPE; no egress fees"],
      walrus: ["$0.023/GB-mo", "USD-pegged, same as S3 — and no egress fees"],
      ipfs: ["Provider-set", "~$0.005–0.15/GB-mo across pinning services, plus bandwidth"],
      s3: ["$0.023/GB-mo", "Cheap to store, $0.09/GB to read out"],
    },
  },
  {
    key: "readspeed",
    title: "Read speed",
    cells: {
      tapedrive: ["Fast", "Served over HTTP from a gateway, slice-cached"],
      walrus: ["Fast", "Served over HTTP from aggregator nodes"],
      ipfs: ["Variable", "Instant on a cache hit, slow on a cold DHT lookup"],
      s3: ["Fast", "Low-latency reads, CDN-frontable for more"],
    },
  },
  {
    key: "maxsize",
    title: "Max file size",
    cells: {
      tapedrive: ["~4.4 TB/tape", "Up to 65,535 tracks of 64 MB each per tape"],
      walrus: ["Large blobs", "Multi-GB blobs, erasure-coded across nodes"],
      ipfs: ["Effectively unbounded", "Chunked into a block DAG; size just means more blocks"],
      s3: ["Up to 5 TB", "Per object; multipart upload required above 5 GB"],
    },
  },
  {
    key: "maturity",
    title: "Maturity & track record",
    cells: {
      tapedrive: ["Unproven", "Pre-launch, no production track record yet"],
      walrus: ["Mainnet since 2025", "Live on Sui, but still early in production"],
      ipfs: ["Live since 2015", "Mature, widely deployed protocol"],
      s3: ["Live since 2006", "Exabyte-scale, the industry baseline"],
    },
  },
  {
    key: "durability",
    title: "Durability",
    cells: {
      tapedrive: ["10-of-20 erasure", "Any 10 of 20 shards rebuild it; nodes forfeit rewards (not stake) for dropping data"],
      walrus: ["Erasure-coded", "Rebuildable even if a large fraction of nodes vanish"],
      ipfs: ["Pin-dependent", "Only as durable as the nodes choosing to pin it"],
      s3: ["11 nines", "99.999999999% designed durability across data centers"],
    },
  },
  {
    key: "privacy",
    title: "Privacy & encryption",
    cells: {
      tapedrive: ["Public", "Encrypt yourself (AES-256) before upload"],
      walrus: ["Public", "Seal: threshold encryption with on-chain access"],
      ipfs: ["Public", "Encrypt yourself (AES-256) before upload"],
      s3: ["Encrypted at rest", "AES-256 by default; AWS holds the keys unless you bring your own"],
    },
  },
  {
    key: "permanence",
    title: "Permanence",
    cells: {
      tapedrive: ["Prepaid term", "One upfront payment reserves a fixed epoch term"],
      walrus: ["Leased", "2-week epochs you renew to keep it alive"],
      ipfs: ["While pinned", "Garbage-collected once nobody pins it"],
      s3: ["While you pay", "Deleted as soon as you stop paying"],
    },
  },
  {
    key: "verifiability",
    title: "Proof it's stored",
    cells: {
      tapedrive: ["Cert on Solana", "A 14-of-20 node committee BLS-signs custody each epoch"],
      walrus: ["Cert on Sui", "Availability certificate, quorum-signed"],
      ipfs: ["Content hash", "Verifies the bytes, not that anyone holds them"],
      s3: ["None", "No cryptographic proof — you trust Amazon's word"],
    },
  },
  {
    key: "delete",
    title: "Who can delete it",
    cells: {
      tapedrive: ["Owner", "The tape authority can delete tracks; expired tapes are reclaimable"],
      walrus: ["Auto-expires", "When the lease ends; no manual delete"],
      ipfs: ["Any pinner", "Gone once every node drops it"],
      s3: ["Amazon or you", "Account action or a court order"],
    },
  },
  {
    key: "ownership",
    title: "Ownership",
    cells: {
      tapedrive: ["User keeps keys", "A Solana account only you control"],
      walrus: ["User keeps keys", "A Sui object only you control"],
      ipfs: ["No owner", "Public CID anyone can replicate"],
      s3: ["Amazon", "Held inside your AWS account"],
    },
  },
  {
    key: "settlement",
    title: "Settlement layer",
    cells: {
      tapedrive: ["Solana", "Commitments + ownership anchored on Solana"],
      walrus: ["Sui", "Blob certificates live as objects on Sui"],
      ipfs: ["None", "No chain — addressed by CID alone"],
      s3: ["None", "No ledger — just AWS's internal control plane"],
    },
  },
  {
    key: "decentralization",
    title: "Decentralization",
    cells: {
      tapedrive: ["Staked nodes", "Independent operators stake TAPE, anchored on Solana"],
      walrus: ["Independent nodes", "Erasure-coded across independent staking operators"],
      ipfs: ["P2P nodes", "Open network, persistence via pinning"],
      s3: ["Amazon only", "One operator, many regions"],
    },
  },
];
