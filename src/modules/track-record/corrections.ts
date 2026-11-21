/**
 * Public CORRECTIONS ledger for settlement / score repairs.
 */

export type CorrectionEntry = {
  id: string;
  at: Date;
  scope: "score" | "result" | "void" | "teams" | "odds" | "other";
  summary: string;
  rowIds?: string[];
  before?: string | null;
  after?: string | null;
};

export function formatCorrectionsMarkdown(
  entries: readonly CorrectionEntry[],
  title = "WinIQ track-record corrections",
): string {
  const lines = [
    `# ${title}`,
    "",
    "Append-only public ledger of repairs that changed settled track-record rows.",
    "Earlier snapshots keep old values; new snapshots carry the repair.",
    "",
  ];
  const sorted = [...entries].sort(
    (a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id),
  );
  for (const entry of sorted) {
    lines.push(`## ${entry.at.toISOString().slice(0, 10)} · ${entry.id}`);
    lines.push("");
    lines.push(`- **Scope:** ${entry.scope}`);
    lines.push(`- **Summary:** ${entry.summary}`);
    if (entry.rowIds?.length) {
      lines.push(`- **Rows:** ${entry.rowIds.join(", ")}`);
    }
    if (entry.before) lines.push(`- **Before:** ${entry.before}`);
    if (entry.after) lines.push(`- **After:** ${entry.after}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function appendCorrection(
  ledger: readonly CorrectionEntry[],
  entry: CorrectionEntry,
): CorrectionEntry[] {
  if (ledger.some((row) => row.id === entry.id)) {
    throw new Error(`correction id already exists: ${entry.id}`);
  }
  return [...ledger, entry];
}
