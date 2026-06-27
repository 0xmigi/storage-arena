// Per-upload price estimate, in each network's NATIVE cost model — one-time for
// pay-once networks, monthly for rented storage. Deliberately NOT normalized to
// a single "winner": the point is that the cost SHAPE differs (pay-once-forever
// vs pay-every-month). Figures are tiny at KB/MB sizes and dramatic at GB scale,
// which is exactly where the tradeoff becomes real. Mirrors the Compare table's
// cost row ($0.023/GB-mo, etc.).
import { Backend, BackendId, segmentCount } from "./backends";

const GIB = 1024 ** 3;

// Storage list prices ($/GiB-month). Walrus is USD-pegged at the protocol level
// (docs.wal.app) at the same rate as S3; IPFS is a representative pinning rate.
const PER_GIB_MO: Partial<Record<BackendId, number>> = {
  s3: 0.023,
  walrus: 0.023,
  ipfs: 0.07,
};

// Tapedrive is pay-once: a fixed account rent + one Solana tx fee per ~893-byte
// segment. Priced in SOL and converted at a HARDCODED assumption (not a live
// feed), so it's an estimate that drifts with the SOL price — flagged with "~".
const SOL_USD = 160; // assumption
const TAPE_FIXED_SOL = 0.0025; // one-time account rent
const TAPE_FEE_SOL = 0.000005; // base fee per signature (5000 lamports)

export type Price = { usd: number; unit: "once" | "mo" };

export function priceUsd(b: Backend, bytes: number): Price | null {
  if (b.id === "tapedrive") {
    const segs = segmentCount(b, bytes) ?? Math.ceil(bytes / 893);
    const sol = TAPE_FIXED_SOL + segs * TAPE_FEE_SOL;
    return { usd: sol * SOL_USD, unit: "once" };
  }
  const rate = PER_GIB_MO[b.id];
  if (rate == null) return null;
  return { usd: (bytes / GIB) * rate, unit: "mo" };
}

// Compact money string + native unit. "~" prefixes the one-time estimate to
// signal it's SOL-derived; recurring storage prices are list rates, shown plain.
export function fmtPrice(p: Price): string {
  const { usd, unit } = p;
  let amt: string;
  if (usd >= 1000) amt = `$${(usd / 1000).toFixed(usd < 10000 ? 1 : 0)}k`;
  else if (usd >= 0.01) amt = `$${usd.toFixed(2)}`;
  else if (usd > 0) amt = "<$0.01";
  else amt = "free";
  const suffix = unit === "once" ? " once" : "/mo";
  return (unit === "once" ? "~" : "") + amt + suffix;
}
