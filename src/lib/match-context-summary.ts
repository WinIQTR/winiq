import { prisma } from "@/lib/prisma";
import {
  aggregateTeamScorerHistory,
  computeChronologicalElo,
  computeRollingForm,
  crossCheckAnalyticVsMonteCarlo,
  deriveGoalLineMarkets,
  priorMatchesForTeam,
  resolvePredictionMode,
  resolveVenueContext,
  type FormMatchRow,
  type ScorerGoalEvent,
} from "@/modules/match-context-engine";

export type MatchContextSummary = {
  matchId: number;
  predictionMode: ReturnType<typeof resolvePredictionMode>;
  venue: ReturnType<typeof resolveVenueContext>;
  homeElo: number | null;
  awayElo: number | null;
  homeForm: ReturnType<typeof computeRollingForm>;
  awayForm: ReturnType<typeof computeRollingForm>;
  homeScorers: ReturnType<typeof aggregateTeamScorerHistory>;
  awayScorers: ReturnType<typeof aggregateTeamScorerHistory>;
  goalLines: ReturnType<typeof deriveGoalLineMarkets> | null;
  monteCarloCheck: ReturnType<typeof crossCheckAnalyticVsMonteCarlo> | null;
};

export async function buildMatchContextSummary(
  matchId: number,
): Promise<MatchContextSummary | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: { include: { country: true } } } },
      lineups: { select: { isConfirmed: true }, take: 4 },
    },
  });
  if (!match) return null;

  const confirmedLineupPresent = match.lineups.some((row) => row.isConfirmed);
  const predictionMode = resolvePredictionMode({
    kickoffAt: match.kickoffAt,
    confirmedLineupPresent,
  });

  const venue = resolveVenueContext({
    venueName: match.venueName,
    venueCity: match.venueCity,
    homeTeamName: match.homeTeam.name,
    homeTeamCity: null,
    homeCountry: null,
    competitionCountry: match.season.league.country?.name ?? null,
    neutralFlag: null,
  });

  const history = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
      OR: [
        { homeTeamId: match.homeTeamId },
        { awayTeamId: match.homeTeamId },
        { homeTeamId: match.awayTeamId },
        { awayTeamId: match.awayTeamId },
      ],
      kickoffAt: { lt: match.kickoffAt },
    },
    orderBy: { kickoffAt: "asc" },
    take: 400,
    select: {
      id: true,
      kickoffAt: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      season: { select: { league: { select: { name: true } } } },
    },
  });

  const eloInput = history.map((row) => ({
    matchId: row.id,
    kickoffAt: row.kickoffAt,
    homeTeamId: String(row.homeTeamId),
    awayTeamId: String(row.awayTeamId),
    homeScore: row.homeScore ?? 0,
    awayScore: row.awayScore ?? 0,
    competition: row.season.league.name,
    neutral: false,
  }));
  const { finalRatings } = computeChronologicalElo(eloInput);

  const formRows: FormMatchRow[] = [];
  for (const row of history) {
    const homeElo = finalRatings.get(String(row.homeTeamId));
    const awayElo = finalRatings.get(String(row.awayTeamId));
    formRows.push({
      matchId: row.id,
      kickoffAt: row.kickoffAt,
      teamId: String(row.homeTeamId),
      opponentId: String(row.awayTeamId),
      goalsFor: row.homeScore ?? 0,
      goalsAgainst: row.awayScore ?? 0,
      ownElo: homeElo ?? null,
      opponentElo: awayElo ?? null,
    });
    formRows.push({
      matchId: row.id,
      kickoffAt: row.kickoffAt,
      teamId: String(row.awayTeamId),
      opponentId: String(row.homeTeamId),
      goalsFor: row.awayScore ?? 0,
      goalsAgainst: row.homeScore ?? 0,
      ownElo: awayElo ?? null,
      opponentElo: homeElo ?? null,
    });
  }

  const homeForm = computeRollingForm(
    priorMatchesForTeam(formRows, String(match.homeTeamId), match.kickoffAt),
  );
  const awayForm = computeRollingForm(
    priorMatchesForTeam(formRows, String(match.awayTeamId), match.kickoffAt),
  );

  const events = await prisma.matchEvent.findMany({
    where: {
      type: { contains: "Goal", mode: "insensitive" },
      match: {
        status: "FINISHED",
        kickoffAt: { lt: match.kickoffAt },
        OR: [
          { homeTeamId: match.homeTeamId },
          { awayTeamId: match.homeTeamId },
          { homeTeamId: match.awayTeamId },
          { awayTeamId: match.awayTeamId },
        ],
      },
    },
    take: 2000,
    select: {
      matchId: true,
      teamId: true,
      playerName: true,
      detail: true,
      match: { select: { kickoffAt: true } },
    },
  });

  const scorerEvents: ScorerGoalEvent[] = events
    .filter((event) => event.teamId != null)
    .map((event) => ({
      matchId: event.matchId,
      kickoffAt: event.match.kickoffAt,
      teamId: String(event.teamId),
      scorerKey: event.playerName?.trim() || "unknown",
      isPenalty: /penalty/i.test(event.detail ?? ""),
      isOwnGoal: /own/i.test(event.detail ?? ""),
    }));

  const homeScorers = aggregateTeamScorerHistory(
    scorerEvents,
    String(match.homeTeamId),
    match.kickoffAt,
  );
  const awayScorers = aggregateTeamScorerHistory(
    scorerEvents,
    String(match.awayTeamId),
    match.kickoffAt,
  );

  const homeGf = homeForm.find((row) => row.window === 10)?.goalsForPerGame;
  const awayGf = awayForm.find((row) => row.window === 10)?.goalsForPerGame;
  let goalLines: ReturnType<typeof deriveGoalLineMarkets> | null = null;
  let monteCarloCheck: ReturnType<typeof crossCheckAnalyticVsMonteCarlo> | null =
    null;
  if (homeGf != null && awayGf != null) {
    const lambdaHome = Math.max(0.2, homeGf);
    const lambdaAway = Math.max(0.2, awayGf);
    const cells: Array<{
      homeGoals: number;
      awayGoals: number;
      probability: number;
    }> = [];
    const poissonPmf = (lambda: number, k: number) =>
      (Math.exp(-lambda) * lambda ** k) / factorial(k);
    for (let h = 0; h <= 6; h += 1) {
      for (let a = 0; a <= 6; a += 1) {
        cells.push({
          homeGoals: h,
          awayGoals: a,
          probability: poissonPmf(lambdaHome, h) * poissonPmf(lambdaAway, a),
        });
      }
    }
    goalLines = deriveGoalLineMarkets(cells);
    const over25 = goalLines.find((row) => row.line === 2.5);
    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;
    for (const cell of cells) {
      if (cell.homeGoals > cell.awayGoals) homeWin += cell.probability;
      else if (cell.homeGoals === cell.awayGoals) draw += cell.probability;
      else awayWin += cell.probability;
    }
    monteCarloCheck = crossCheckAnalyticVsMonteCarlo(
      {
        homeWinProb: homeWin,
        drawProb: draw,
        awayWinProb: awayWin,
        over25Prob: over25?.overProb,
      },
      lambdaHome,
      lambdaAway,
      { simulations: 8_000, seed: matchId },
    );
  }

  return {
    matchId,
    predictionMode,
    venue,
    homeElo: finalRatings.get(String(match.homeTeamId)) ?? null,
    awayElo: finalRatings.get(String(match.awayTeamId)) ?? null,
    homeForm,
    awayForm,
    homeScorers,
    awayScorers,
    goalLines,
    monteCarloCheck,
  };
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}
