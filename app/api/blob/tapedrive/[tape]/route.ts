import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { fileTypeFromBuffer } from "@/lib/filetype";

export const runtime = "nodejs";
export const maxDuration = 60;

const execFileP = promisify(execFile);

// Serve a Tapedrive tape's bytes back over HTTP, by reading it with the CLI.
// This is what makes a tape's "view it" link work in a browser. Cross-device
// access requires this backend to be reachable (a host or tunnel).
export async function GET(
  _req: NextRequest,
  { params }: { params: { tape: string } }
) {
  const bin = process.env.TAPEDRIVE_BIN;
  const keypair = process.env.TAPEDRIVE_KEYPAIR;
  const tape = params.tape;
  if (!bin || !keypair) {
    return NextResponse.json({ error: "tapedrive CLI not configured" }, { status: 503 });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tape)) {
    return NextResponse.json({ error: "bad tape address" }, { status: 400 });
  }

  const out = join(tmpdir(), `read-${randomUUID()}`);
  try {
    await execFileP(bin, ["-k", keypair, "-u", "d", "read", tape, "-o", out], {
      timeout: 55_000,
    });
    const data = await readFile(out);
    const type = fileTypeFromBuffer(new Uint8Array(data)) ?? "application/octet-stream";
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `read failed: ${e?.message ?? "error"}` },
      { status: 502 }
    );
  } finally {
    unlink(out).catch(() => {});
  }
}
