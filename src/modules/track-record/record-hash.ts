/**
 * Prediction-only record hash — excludes closing prices, results, value_* .
 */

import { createHash } from "node:crypto";

export type RecordHashFields = {
  id: string;
  matchId: string;
  league: string;
  home: string;
  away: string;
  kickoffAt: Date | string;
  probability: number;
  pinOpenHome?: number | null;
  pinOpenDraw?: number | null;
  pinOpenAway?: number | null;
  loggedAt: Date | string;
};

export function buildRecordHashPayload(fields: RecordHashFields): string {
  const kickoff =
    fields.kickoffAt instanceof Date
      ? fields.kickoffAt.toISOString()
      : fields.kickoffAt;
  const logged =
    fields.loggedAt instanceof Date
      ? fields.loggedAt.toISOString()
      : fields.loggedAt;
  return [
    fields.id,
    fields.matchId,
    fields.league,
    fields.home,
    fields.away,
    kickoff,
    fields.probability.toFixed(6),
    formatOpt(fields.pinOpenHome),
    formatOpt(fields.pinOpenDraw),
    formatOpt(fields.pinOpenAway),
    logged,
  ].join("|");
}

export function computeRecordHash(fields: RecordHashFields): string {
  return createHash("sha256")
    .update(buildRecordHashPayload(fields))
    .digest("hex")
    .slice(0, 16);
}

function formatOpt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(3);
}
