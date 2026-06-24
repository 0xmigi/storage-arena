"use client";

import { useState } from "react";
import { Dash, Plus } from "./Icons";

const ITEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is S3 a product or a standard?",
    a: (
      <>
        Both. S3 is Amazon&apos;s specific object-storage product — but its{" "}
        <span className="text-ink">API became the industry standard</span>.
        Cloudflare R2, MinIO, Backblaze, and Wasabi all speak
        &ldquo;S3-compatible,&rdquo; which is exactly why this app talks to R2
        using the AWS SDK. &ldquo;Object storage&rdquo; is the architecture; the
        S3 API is the lingua franca. Azure Blob and Google Cloud Storage are
        alternatives with their own APIs.
      </>
    ),
  },
  {
    q: "Object vs block vs file storage — what's the difference?",
    a: (
      <>
        Three shapes of storage. <span className="text-ink">Block</span> = raw
        blocks, like a virtual hard drive (databases and VMs sit on it; AWS EBS,
        SANs). <span className="text-ink">File</span> = folders and a filesystem
        over a network (NFS/SMB) — this is what a NAS is.{" "}
        <span className="text-ink">Object</span> = a flat sea of blobs, each with
        a key and metadata, accessed over HTTP and scaling effectively
        infinitely (S3, R2, GCS).
      </>
    ),
  },
  {
    q: "What's a NAS? And hot vs cold storage?",
    a: (
      <>
        A <span className="text-ink">NAS</span> (Network Attached Storage) is a
        box of drives on your local network speaking file protocols — file
        storage you own; a SAN is its block-storage cousin.{" "}
        <span className="text-ink">Hot vs cold</span> is a latency-versus-cost
        axis: hot = instant access, pricier (SSD, S3 Standard); cold/archive =
        cheap but retrieval takes minutes to hours (S3 Glacier, and LTO tape
        libraries — still how most of the world&apos;s archives are stored). The
        physical ladder runs SSD → HDD → tape, fast/expensive to slow/cheap.
      </>
    ),
  },
  {
    q: "What counts as a “successful upload”? (it's different in each)",
    a: (
      <>
        This is the key idea — &ldquo;done&rdquo; is a different trust event each
        time. <span className="text-ink">S3</span>: one company returns HTTP 200.{" "}
        <span className="text-ink">IPFS</span>: a CID exists and ≥1 node pins it
        (no persistence guarantee on its own).{" "}
        <span className="text-ink">Filecoin</span>: an on-chain storage deal with
        proofs is active. <span className="text-ink">Arweave</span>: a
        transaction is mined, permanence funded by an endowment.{" "}
        <span className="text-ink">Walrus</span>: an availability certificate is
        issued on Sui once a quorum holds the slivers.{" "}
        <span className="text-ink">Tapedrive</span>: the tape is finalized on
        Solana. Different guarantees, not just different speeds.
      </>
    ),
  },
  {
    q: "Walrus vs Arweave — why are they different?",
    a: (
      <>
        Different optimization targets. <span className="text-ink">Arweave</span>{" "}
        optimizes <span className="text-ink">permanence</span>: pay once, stored
        &ldquo;forever,&rdquo; funded by an endowment, with fuller replication.{" "}
        <span className="text-ink">Walrus</span> optimizes{" "}
        <span className="text-ink">cheap large blobs now</span>: erasure-coded
        slivers you can rebuild from a fraction (~4–5× overhead vs naive
        replication&apos;s 10–100×), paid per renewable epoch. One sells forever;
        the other sells cheap availability.
      </>
    ),
  },
  {
    q: "IPFS vs Filecoin?",
    a: (
      <>
        <span className="text-ink">IPFS</span> is addressing and transport — it
        gives content a hash-based name (CID) but guarantees nothing stays
        online. <span className="text-ink">Filecoin</span> is the incentive
        layer on top: miners post collateral and cryptographically prove
        (PoRep/PoSt) they&apos;re storing your data for a paid deal. IPFS{" "}
        <em>names</em> it; Filecoin makes someone <em>keep</em> it.
      </>
    ),
  },
  {
    q: "Ownership vs privacy — how should I model it?",
    a: (
      <>
        Two separate switches. <span className="text-ink">Ownership</span> means
        the data&apos;s identity is independent of any host and a key controls it
        — not an account a company can close. <span className="text-ink">Privacy</span>{" "}
        means nobody can read it — a separate encryption layer you add{" "}
        <em>before</em> upload. Decentralized storage gives ownership by default
        but is often public (IPFS is discoverable, chains are transparent), so
        privacy means encrypting client-side and letting the network hold only
        ciphertext.
      </>
    ),
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="mt-16 border-t border-line pt-6">
      <div className="mb-3 text-[11px] uppercase tracking-widest text-muted">
        FAQ
      </div>
      <div>
        {ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="border-b border-line">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-3 py-4 text-left text-sm"
              >
                <span className="text-muted">
                  {isOpen ? <Dash size={16} /> : <Plus size={16} />}
                </span>
                <span className="font-medium">{item.q}</span>
              </button>
              {isOpen && (
                <div className="pb-4 pl-7 pr-4 text-[13px] leading-relaxed text-muted">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
