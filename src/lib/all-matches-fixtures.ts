import type {
  DashboardPrediction,
} from "@/lib/prediction-dashboard-shared";

export type AllMatchesFixture = {
  matchId: number;
  kickoffAt: Date;
  status: string;
  leagueApiId: number;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeForm?: ("W" | "D" | "L")[];
  awayForm?: ("W" | "D" | "L")[];
  homeScore: number | null;
  awayScore: number | null;
};

/**
 * The full fixture archive remains authoritative. A published prediction is
 * appended only when its fixture is absent, so All Matches can never hide an
 * official recommendation because of an incomplete fixture snapshot.
 */
export function mergeFixturesWithPublishedPredictions(
  fixtures: readonly AllMatchesFixture[],
  predictions: readonly DashboardPrediction[],
): AllMatchesFixture[] {
  const merged = new Map(
    fixtures.map((fixture) => [fixture.matchId, fixture]),
  );

  for (const prediction of predictions) {
    if (merged.has(prediction.matchId)) {
      continue;
    }

    merged.set(prediction.matchId, {
      matchId: prediction.matchId,
      kickoffAt: prediction.kickoffAt,
      status:
        (
          prediction.settlementStatus === "WON" ||
          prediction.settlementStatus === "LOST" ||
          prediction.settlementStatus === "VOID"
        ) ||
        (
          prediction.finalHomeScore !== null &&
          prediction.finalHomeScore !== undefined &&
          prediction.finalAwayScore !== null &&
          prediction.finalAwayScore !== undefined
        )
          ? "FINISHED"
          : "SCHEDULED",
      leagueApiId: prediction.leagueApiId,
      leagueName: prediction.leagueName,
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      homeTeamLogo: prediction.homeTeamLogo,
      awayTeamLogo: prediction.awayTeamLogo,
      homeForm: prediction.homeRecentResults,
      awayForm: prediction.awayRecentResults,
      homeScore: prediction.finalHomeScore ?? null,
      awayScore: prediction.finalAwayScore ?? null,
    });
  }

  return [...merged.values()];
}

export function selectAndSortAllMatches(
  fixtures: readonly AllMatchesFixture[],
  publishedMatchIds: ReadonlySet<number>,
  selectedLeague: number | "ALL",
  now: Date = new Date(),
): AllMatchesFixture[] {
  return fixtures
    .filter(
      (fixture) =>
        isNotStartedFixture(fixture, now) &&
        (
          selectedLeague === "ALL" ||
          fixture.leagueApiId === selectedLeague
        ),
    )
    .sort((first, second) => {
      const firstRecommended = publishedMatchIds.has(first.matchId) ? 0 : 1;
      const secondRecommended = publishedMatchIds.has(second.matchId) ? 0 : 1;

      if (firstRecommended !== secondRecommended) {
        return firstRecommended - secondRecommended;
      }

      return first.kickoffAt.getTime() - second.kickoffAt.getTime();
    });
}

export function selectUpcomingFixtureWindow(
  fixtures: readonly AllMatchesFixture[],
  weeks: 1 | 2 | 3,
  now: Date = new Date(),
): AllMatchesFixture[] {
  const maximumKickoff =
    now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000;

  return fixtures.filter(
    (fixture) =>
      fixture.kickoffAt.getTime() > now.getTime() &&
      fixture.kickoffAt.getTime() <= maximumKickoff,
  );
}

export function isNotStartedFixture(
  fixture: AllMatchesFixture,
  now: Date = new Date(),
): boolean {
  return (
    (
      fixture.status === "SCHEDULED" ||
      fixture.status === "NOT_STARTED"
    ) &&
    fixture.homeScore === null &&
    fixture.awayScore === null &&
    fixture.kickoffAt.getTime() > now.getTime()
  );
}

export function isFinishedFixture(
  fixture: AllMatchesFixture,
): boolean {
  return (
    fixture.status === "FINISHED" ||
    (
      fixture.homeScore !== null &&
      fixture.awayScore !== null
    )
  );
}

export function selectAndSortFinishedMatches(
  fixtures: readonly AllMatchesFixture[],
  publishedMatchIds: ReadonlySet<number>,
  selectedLeague: number | "ALL",
): AllMatchesFixture[] {
  return fixtures
    .filter(
      (fixture) =>
        isFinishedFixture(fixture) &&
        (
          selectedLeague === "ALL" ||
          fixture.leagueApiId === selectedLeague
        ),
    )
    .sort((first, second) => {
      const firstRecommended = publishedMatchIds.has(first.matchId) ? 0 : 1;
      const secondRecommended = publishedMatchIds.has(second.matchId) ? 0 : 1;

      if (firstRecommended !== secondRecommended) {
        return firstRecommended - secondRecommended;
      }

      return second.kickoffAt.getTime() - first.kickoffAt.getTime();
    });
}
