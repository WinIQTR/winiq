/**
 * Adapters from WinIQ evaluation / dashboard rows → SettledOneXTwoRow.
 */

import { derivePick } from "@/modules/prediction-audit/settled-export";
import { resultFromScores } from "@/modules/prediction-audit/scoring";
import type {
  OneXTwoResult,
  SettledOneXTwoRow,
} from "@/modules/prediction-audit/types";

export type Soft1X2Prediction = {
  matchId: number | string;
  leagueName: string;
  leagueApiId?: number | null;
  kickoffAt: Date;
  homeTeam: string;
  awayTeam: string;
  predictedOutcome?: "HOME" | "DRAW" | "AWAY" | null;
  predictedProbability?: number;
  pHome?: number;
  pDraw?: number;
  pAway?: number;
  lambdaHome?: number | null;
  lambdaAway?: number | null;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
  actualOutcome?: "HOME" | "DRAW" | "AWAY" | null;
  isCorrect?: boolean;
  modelVersion?: string;
  publishedAt?: Date | null;
  firstSeenAt?: Date | null;
  marketKey?: string;
  selection?: string;
};

function outcomeToPick(
  value: "HOME" | "DRAW" | "AWAY" | null | undefined,
): OneXTwoResult | null {
  if (value === "HOME") return "1";
  if (value === "DRAW") return "X";
  if (value === "AWAY") return "2";
  return null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build a 1X2 row. Prefer explicit pHome/pDraw/pAway; otherwise place
 * predictedProbability on the picked outcome and split the remainder.
 */
export function softPredictionToOneXTwo(
  row: Soft1X2Prediction,
): SettledOneXTwoRow | null {
  const pick =
    outcomeToPick(row.predictedOutcome) ??
    (row.selection
      ? outcomeToPick(
          /draw/i.test(row.selection)
            ? "DRAW"
            : /away/i.test(row.selection)
              ? "AWAY"
              : /home/i.test(row.selection)
                ? "HOME"
                : null,
        )
      : null);

  let pHome = row.pHome;
  let pDraw = row.pDraw;
  let pAway = row.pAway;

  if (
    (pHome === undefined || pDraw === undefined || pAway === undefined) &&
    pick &&
    row.predictedProbability !== undefined
  ) {
    const p = Math.min(0.99, Math.max(0.01, row.predictedProbability / (row.predictedProbability > 1 ? 100 : 1)));
    const rest = (1 - p) / 2;
    pHome = pick === "1" ? p : rest;
    pDraw = pick === "X" ? p : rest;
    pAway = pick === "2" ? p : rest;
  }

  if (
    pHome === undefined ||
    pDraw === undefined ||
    pAway === undefined ||
    !Number.isFinite(pHome) ||
    !Number.isFinite(pDraw) ||
    !Number.isFinite(pAway)
  ) {
    return null;
  }

  const resolvedPick = pick ?? derivePick(pHome, pDraw, pAway);
  const result =
    outcomeToPick(row.actualOutcome) ??
    (row.actualHomeScore !== null &&
    row.actualHomeScore !== undefined &&
    row.actualAwayScore !== null &&
    row.actualAwayScore !== undefined
      ? resultFromScores(row.actualHomeScore, row.actualAwayScore)
      : null);

  return {
    fixtureId: String(row.matchId),
    kickoffAt: row.kickoffAt,
    leagueKey: row.leagueApiId
      ? String(row.leagueApiId)
      : slugify(row.leagueName),
    leagueName: row.leagueName,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    homeScore: row.actualHomeScore ?? null,
    awayScore: row.actualAwayScore ?? null,
    result,
    pHome,
    pDraw,
    pAway,
    lambdaHome: row.lambdaHome ?? null,
    lambdaAway: row.lambdaAway ?? null,
    pick: resolvedPick,
    pickCorrect:
      row.isCorrect ??
      (result !== null ? resolvedPick === result : null),
    modelVersion: row.modelVersion ?? "winiq",
    pickWrittenAt: row.publishedAt ?? null,
    firstSeenAt: row.firstSeenAt ?? row.publishedAt ?? null,
  };
}

export function softPredictionsToOneXTwo(
  rows: readonly Soft1X2Prediction[],
): SettledOneXTwoRow[] {
  const out: SettledOneXTwoRow[] = [];
  for (const row of rows) {
    // Prefer Match Result / 1X2 rows when marketKey is present.
    if (
      row.marketKey &&
      !/match.?result|1x2|full.?time/i.test(row.marketKey) &&
      row.pHome === undefined
    ) {
      continue;
    }
    const converted = softPredictionToOneXTwo(row);
    if (converted) out.push(converted);
  }
  return out;
}
