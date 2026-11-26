import { prisma } from "@/lib/prisma";

import type { MatchEventRow, MatchLiveBoard, StandingRow } from "@/lib/match-live-board-shared";

export type { MatchEventRow, MatchLiveBoard, StandingRow } from "@/lib/match-live-board-shared";
export {
  formatMatchScore,
  matchStatusLabel,
} from "@/lib/match-live-board-shared";

/**
 * Batch Match score/status for member list + detail.
 * No invented scores — nulls stay empty in UI.
 */
export async function loadMatchLiveBoards(
  matchIds: number[],
): Promise<Record<number, MatchLiveBoard>> {
  const ids = [...new Set(matchIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return {};

  const rows = await prisma.match.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      statusShort: true,
      homeScore: true,
      awayScore: true,
    },
  });

  const out: Record<number, MatchLiveBoard> = {};
  for (const row of rows) {
    out[row.id] = {
      matchId: row.id,
      status: row.status,
      statusShort: row.statusShort,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
    };
  }
  return out;
}

export async function loadMatchEvents(matchId: number): Promise<MatchEventRow[]> {
  const rows = await prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: [{ elapsed: "asc" }, { id: "asc" }],
    select: {
      elapsed: true,
      extra: true,
      type: true,
      detail: true,
      playerName: true,
      assistName: true,
      teamId: true,
    },
  });
  return rows;
}

export async function loadLeagueStandingsForMatch(
  matchId: number,
): Promise<StandingRow[]> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { seasonId: true },
  });
  if (!match) return [];

  const rows = await prisma.leagueStanding.findMany({
    where: { seasonId: match.seasonId },
    orderBy: [{ rank: "asc" }],
    take: 24,
    select: {
      rank: true,
      points: true,
      played: true,
      won: true,
      drawn: true,
      lost: true,
      goalsFor: true,
      goalsAgainst: true,
      goalDiff: true,
      form: true,
      teamId: true,
      team: { select: { name: true, logoUrl: true } },
    },
  });

  return rows.map((row) => ({
    rank: row.rank,
    points: row.points,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDiff: row.goalDiff,
    form: row.form,
    teamId: row.teamId,
    teamName: row.team.name,
    teamLogo: row.team.logoUrl,
  }));
}
