import { NextRequest, NextResponse } from "next/server";
import { fileTypeFromBuffer } from "@/lib/filetype";

export const runtime = "nodejs";

const WALRUS_AGGREGATOR =
  process.env.WALRUS_AGGREGATOR ??
  "https://aggregator.walrus-testnet.walrus.space";

// Walrus is content-agnostic — its aggregator serves raw bytes as
// octet-stream, so browsers won't render images. Fetch the blob, sniff the
// type, and re-serve with the right Content-Type so it displays. Data still
// originates from Walrus.
export async function GET(
  _req: NextRequest,
  { params }: { params: { blobId: string } }
) {
  const blobId = params.blobId;
  if (!/^[A-Za-z0-9_\-]{16,128}$/.test(blobId)) {
    return NextResponse.json({ error: "bad blob id" }, { status: 400 });
  }
  try {
    const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `walrus ${res.status}` }, { status: 502 });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const type = fileTypeFromBuffer(new Uint8Array(buf)) ?? "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `fetch failed: ${e?.message ?? "error"}` },
      { status: 502 }
    );
  }
}
