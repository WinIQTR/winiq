/**
 * Build TrackRecordRow views from WinIQ archive-shaped rows.
 */

import { computeLabeledClv } from "@/modules/track-record/clv-labeled";
import { doubleChanceWins } from "@/modules/track-record/double-chance";
import { isLoggedBeforeKickoff } from "@/modules/track-record/logged-before-kickoff";
import { computeRecordHash } from "@/modules/track-record/record-hash";
import type {
  TrackPick,
  TrackRecordRow,
  VoidReason,
} from "@/modules/track-record/types";
import { voidReasonFromMatchStatus } from "@/modules/track-record/void-reason";

export type ArchiveLikeRow = {
  id: string | number;
  matchId: string | number;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: Date;
  publishedAt: Date;
  selection: string;
  marketKey?: string;
  probability: number;
  fairOdds?: number | null;
  marketOdds?: number | null;
  bestOdds?: number | null;
  closingOdds?: number | null;
  pinOpen?: number | null;
  pinClose?: number | null;
  bestSoft?: number | null;
  bestSoftBook?: string | null;
  /** WON/LOST/VOID or 1/X/2 */
  result?: string | null;
  actualOutcome?: "HOME" | "DRAW" | "AWAY" | null;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
  matchStatus?: string | null;
  voidReason?: VoidReason | null;
  teamsReversedAfterLogging?: boolean;
};

function inferPick(selection: string, marketKey?: string): TrackPick | null {
  const hay = `${marketKey ?? ""} ${selection}`.toLowerCase();
  if (/\b1x\b|home or draw|ev veya berabere/.test(hay)) return "1X";
  if (/\b12\b|home or away|ev veya dep/.test(hay)) return "12";
  if (/\bx2\b|draw or away|berabere veya dep/.test(hay)) return "X2";
  if (/draw|beraber/.test(hay)) return "X";
  if (/away|deplasman/.test(hay)) return "2";
  if (/home|ev sahibi/.test(hay)) return "1";
  return null;
}

function toOneXTwo(
  row: ArchiveLikeRow,
): "1" | "X" | "2" | null {
  if (row.result === "1" || row.result === "X" || row.result === "2") {
    return row.result;
  }
  if (row.actualOutcome === "HOME") return "1";
  if (row.actualOutcome === "DRAW") return "X";
  if (row.actualOutcome === "AWAY") return "2";
  if (
    row.actualHomeScore !== null &&
    row.actualHomeScore !== undefined &&
    row.actualAwayScore !== null &&
    row.actualAwayScore !== undefined
  ) {
    if (row.actualHomeScore > row.actualAwayScore) return "1";
    if (row.actualHomeScore < row.actualAwayScore) return "2";
    return "X";
  }
  return null;
}

export function archiveRowToTrackRecord(
  row: ArchiveLikeRow,
): TrackRecordRow | null {
  const pick = inferPick(row.selection, row.marketKey);
  if (!pick) return null;
  const probability =
    row.probability > 1 ? row.probability / 100 : row.probability;
  const oddsTaken =
    row.marketOdds ??
    row.bestOdds ??
    (row.fairOdds && row.fairOdds > 1 ? row.fairOdds : null);
  if (!(oddsTaken && oddsTaken > 1)) return null;

  const loggedBeforeKickoff = isLoggedBeforeKickoff(
    row.publishedAt,
    row.kickoffAt,
  );
  const statusVoid = voidReasonFromMatchStatus(row.matchStatus);
  const voidReason: VoidReason | null =
    row.voidReason ??
    statusVoid ??
    (row.result === "VOID" ? "other" : null);
  const oneXTwo = voidReason ? null : toOneXTwo(row);

  let predictionWon: boolean | null = null;
  if (!voidReason) {
    if (oneXTwo) {
      predictionWon = doubleChanceWins(pick, oneXTwo);
    } else if (row.result === "WON") {
      predictionWon = true;
    } else if (row.result === "LOST") {
      predictionWon = false;
    }
  }

  const id = String(row.id);
  const matchId = String(row.matchId);
  const recordHash = computeRecordHash({
    id,
    matchId,
    league: row.leagueName,
    home: row.homeTeam,
    away: row.awayTeam,
    kickoffAt: row.kickoffAt,
    probability,
    pinOpenHome:
      pick === "1" || pick === "1X" || pick === "12" ? row.pinOpen : null,
    pinOpenDraw:
      pick === "X" || pick === "1X" || pick === "X2" ? row.pinOpen : null,
    pinOpenAway:
      pick === "2" || pick === "12" || pick === "X2" ? row.pinOpen : null,
    loggedAt: row.publishedAt,
  });

  return {
    id,
    matchId,
    league: row.leagueName,
    home: row.homeTeam,
    away: row.awayTeam,
    kickoffAt: row.kickoffAt,
    loggedAt: row.publishedAt,
    pick,
    probability,
    oddsTaken,
    pinOpen: row.pinOpen ?? null,
    pinClose: row.pinClose ?? row.closingOdds ?? null,
    bestSoft: row.bestSoft ?? row.bestOdds ?? null,
    bestSoftBook: row.bestSoftBook ?? null,
    result: oneXTwo,
    voidReason,
    predictionWon,
    loggedBeforeKickoff,
    teamsReversedAfterLogging: row.teamsReversedAfterLogging ?? false,
    recordHash,
  };
}

export function trackRowsWithClv(rows: readonly TrackRecordRow[]) {
  return rows.map((row) => ({
    row,
    clv: computeLabeledClv({
      oddsTaken: row.oddsTaken,
      closingOdds: row.pinClose,
      fairProbability: row.probability,
    }),
  }));
}
