/**
 * Immutable daily track snapshots + SHA-256 manifest (TipsAudit pattern).
 * Snapshots are never overwritten; each write creates a new timestamped file.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type TrackSnapshotMeta = {
  fileName: string;
  sha256: string;
  generatedAt: string;
  count: number;
};

export type ManifestRow = {
  fileName: string;
  sha256: string;
  generatedAt: string;
  count: number;
};

export const DEFAULT_TRACK_DIR = path.join(process.cwd(), "reports", "track");
export const DEFAULT_MANIFEST_PATH = path.join(
  DEFAULT_TRACK_DIR,
  "manifest.csv",
);

export function sha256OfText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function formatTrackFileName(at: Date = new Date()): string {
  const iso = at.toISOString().replace(/[:.]/g, "-");
  return `track-${iso}.json`;
}

export function serializeTrackSnapshot(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export async function writeImmutableTrackSnapshot(
  payload: {
    generatedAt?: Date;
    predictions: unknown[];
    source?: string;
    note?: string;
  },
  options?: {
    trackDir?: string;
    manifestPath?: string;
  },
): Promise<TrackSnapshotMeta> {
  const trackDir = options?.trackDir ?? DEFAULT_TRACK_DIR;
  const manifestPath = options?.manifestPath ?? DEFAULT_MANIFEST_PATH;
  const generatedAt = payload.generatedAt ?? new Date();
  const fileName = formatTrackFileName(generatedAt);
  const body = serializeTrackSnapshot({
    source: payload.source ?? "winiq",
    generated_at: generatedAt.toISOString(),
    count: payload.predictions.length,
    note: payload.note ?? "Immutable track snapshot; never overwrite.",
    predictions: payload.predictions,
  });
  const digest = sha256OfText(body);
  await mkdir(trackDir, { recursive: true });
  const filePath = path.join(trackDir, fileName);
  await writeFile(filePath, body, "utf8");
  await appendManifestRow(
    {
      fileName,
      sha256: digest,
      generatedAt: generatedAt.toISOString(),
      count: payload.predictions.length,
    },
    manifestPath,
  );
  // Convenience pointer (may overwrite) — hash history stays in timestamped files.
  await writeFile(path.join(trackDir, "latest.json"), body, "utf8");
  return {
    fileName,
    sha256: digest,
    generatedAt: generatedAt.toISOString(),
    count: payload.predictions.length,
  };
}

export async function appendManifestRow(
  row: ManifestRow,
  manifestPath = DEFAULT_MANIFEST_PATH,
): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  let existing = "";
  try {
    existing = await readFile(manifestPath, "utf8");
  } catch {
    existing = "file_name,sha256,generated_at,count\n";
  }
  if (!existing.includes("file_name,sha256")) {
    existing = "file_name,sha256,generated_at,count\n" + existing;
  }
  const line = `${row.fileName},${row.sha256},${row.generatedAt},${row.count}\n`;
  if (!existing.endsWith("\n") && existing.length > 0) existing += "\n";
  await writeFile(manifestPath, existing + line, "utf8");
}

export function parseManifestCsv(text: string): ManifestRow[] {
  const lines = text.trim().split(/\r?\n/).slice(1);
  return lines
    .map((line) => line.split(","))
    .filter((cols) => cols.length >= 4)
    .map((cols) => ({
      fileName: cols[0]!,
      sha256: cols[1]!,
      generatedAt: cols[2]!,
      count: Number(cols[3]),
    }));
}

export async function verifyManifestEntry(
  trackDir: string,
  row: ManifestRow,
): Promise<boolean> {
  const text = await readFile(path.join(trackDir, row.fileName), "utf8");
  return sha256OfText(text) === row.sha256;
}
