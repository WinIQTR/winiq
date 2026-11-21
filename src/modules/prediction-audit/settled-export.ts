/**
 * Flat settled-prediction export schema (open-data all.csv columns).
 */

import { resultFromScores } from "@/modules/prediction-audit/scoring";
import type {
  OneXTwoResult,
  SettledOneXTwoRow,
} from "@/modules/prediction-audit/types";

export const SETTLED_EXPORT_COLUMNS = [
  "fixture_id",
  "kickoff_utc",
  "league",
  "league_slug",
  "country",
  "home_team",
  "away_team",
  "home_score",
  "away_score",
  "result",
  "p_home",
  "p_draw",
  "p_away",
  "lambda_home",
  "lambda_away",
  "pick",
  "pick_correct",
  "model_version",
  "pick_written_utc",
  "first_seen_utc",
] as const;

export type SettledExportRow = Record<
  (typeof SETTLED_EXPORT_COLUMNS)[number],
  string
>;

export function toSettledExportRow(row: SettledOneXTwoRow): SettledExportRow {
  const result =
    row.result ??
    (row.homeScore !== null && row.awayScore !== null
      ? resultFromScores(row.homeScore, row.awayScore)
      : null);
  const pickCorrect =
    row.pickCorrect ??
    (result !== null ? row.pick === result : null);

  return {
    fixture_id: row.fixtureId,
    kickoff_utc: row.kickoffAt.toISOString(),
    league: row.leagueName,
    league_slug: row.leagueKey,
    country: row.country ?? "",
    home_team: row.homeTeam,
    away_team: row.awayTeam,
    home_score: row.homeScore === null ? "" : String(row.homeScore),
    away_score: row.awayScore === null ? "" : String(row.awayScore),
    result: (result ?? "") as string,
    p_home: formatProb(row.pHome),
    p_draw: formatProb(row.pDraw),
    p_away: formatProb(row.pAway),
    lambda_home:
      row.lambdaHome === null || row.lambdaHome === undefined
        ? ""
        : String(row.lambdaHome),
    lambda_away:
      row.lambdaAway === null || row.lambdaAway === undefined
        ? ""
        : String(row.lambdaAway),
    pick: row.pick,
    pick_correct:
      pickCorrect === null ? "" : pickCorrect ? "1" : "0",
    model_version: row.modelVersion,
    pick_written_utc: row.pickWrittenAt?.toISOString() ?? "",
    first_seen_utc: row.firstSeenAt?.toISOString() ?? "",
  };
}

export function serializeSettledExportCsv(
  rows: readonly SettledOneXTwoRow[],
): string {
  const body = rows.map((row) => {
    const exported = toSettledExportRow(row);
    return SETTLED_EXPORT_COLUMNS.map((col) =>
      csvEscape(exported[col]),
    ).join(",");
  });
  return (
    SETTLED_EXPORT_COLUMNS.join(",") +
    "\n" +
    body.join("\n") +
    (body.length ? "\n" : "")
  );
}

function formatProb(value: number): string {
  return (Math.round(value * 10000) / 10000).toFixed(4);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function derivePick(
  pHome: number,
  pDraw: number,
  pAway: number,
): OneXTwoResult {
  if (pHome >= pDraw && pHome >= pAway) return "1";
  if (pDraw >= pAway) return "X";
  return "2";
}
