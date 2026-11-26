/**
 * Shared API-Football fixture.status.short → MatchStatus mapping.
 * Used by live poller (and safe to reuse from importers later).
 */

export type MatchStatusValue =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED";

const LIVE_CODES = new Set([
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "LIVE",
  "INT",
  "SUSP",
]);

const FINISHED_CODES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const POSTPONED_CODES = new Set(["PST"]);
const CANCELLED_CODES = new Set(["CANC", "ABD"]);
const SCHEDULED_CODES = new Set(["TBD", "NS"]);

export function mapApiFootballFixtureStatus(
  statusCode?: string | null,
): MatchStatusValue {
  const code = (statusCode ?? "").trim().toUpperCase();
  if (!code || SCHEDULED_CODES.has(code)) return "SCHEDULED";
  if (LIVE_CODES.has(code)) return "LIVE";
  if (FINISHED_CODES.has(code)) return "FINISHED";
  if (POSTPONED_CODES.has(code)) return "POSTPONED";
  if (CANCELLED_CODES.has(code)) return "CANCELLED";
  return "SCHEDULED";
}

/** Prefer full-time when present; else live goals. Never invent. */
export function resolveFixtureScores(input: {
  goalsHome?: number | null;
  goalsAway?: number | null;
  fulltimeHome?: number | null;
  fulltimeAway?: number | null;
}): { homeScore: number | null; awayScore: number | null } {
  const home =
    typeof input.fulltimeHome === "number"
      ? input.fulltimeHome
      : typeof input.goalsHome === "number"
        ? input.goalsHome
        : null;
  const away =
    typeof input.fulltimeAway === "number"
      ? input.fulltimeAway
      : typeof input.goalsAway === "number"
        ? input.goalsAway
        : null;
  return { homeScore: home, awayScore: away };
}
