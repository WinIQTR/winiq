import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  apiFootballRequest,
} from "@/lib/api-football/client";

import {
  loadDashboardPredictionSnapshot,
} from "@/lib/prediction-dashboard-snapshot";

import {
  prisma,
} from "@/lib/prisma";

import {
  summarizeApiQuota,
  summarizeLeagueCoverage,
  type ApiFootballStatus,
  type ApiQuotaSummary,
  type CoverageMatch,
  type LeagueCoverageSummary,
} from "@/lib/production-data-coverage-shared";

import {
  saveProductionDataCoverageSnapshot,
  type ProductionDataCoverageSnapshot,
} from "@/lib/production-data-coverage-snapshot";

export {
  summarizeApiQuota,
  summarizeLeagueCoverage,
} from "@/lib/production-data-coverage-shared";

export type {
  ApiQuotaSummary,
  LeagueCoverageSummary,
} from "@/lib/production-data-coverage-shared";

const COVERAGE_SCHEMA_VERSION = 1;

function emptyApiSummary(
  state: ApiQuotaSummary["state"],
): ApiQuotaSummary {
  return {
    state,
    plan: null,
    active: null,
    endsAt: null,
    usedToday: null,
    dailyLimit: null,
    remainingToday: null,
  };
}

function totalCoverage(
  leagues: readonly LeagueCoverageSummary[],
): ProductionDataCoverageSnapshot["totals"] {
  return leagues.reduce(
    (total, league) => {
      total.fixtures += league.fixtures;
      total.finished += league.finished;
      total.scheduled += league.scheduled;
      total.live += league.live;
      total.postponedOrCancelled +=
        league.postponedOrCancelled;
      total.missingFinalScores +=
        league.missingFinalScores;
      total.publishedCandidates +=
        league.publishedCandidates;

      if (
        league.lastDatabaseUpdateAt &&
        (
          total.lastDatabaseUpdateAt === null ||
          league.lastDatabaseUpdateAt >
            total.lastDatabaseUpdateAt
        )
      ) {
        total.lastDatabaseUpdateAt =
          league.lastDatabaseUpdateAt;
      }

      return total;
    },
    {
      leagues: leagues.length,
      fixtures: 0,
      finished: 0,
      scheduled: 0,
      live: 0,
      postponedOrCancelled: 0,
      missingFinalScores: 0,
      publishedCandidates: 0,
      lastDatabaseUpdateAt: null,
    } as ProductionDataCoverageSnapshot["totals"],
  );
}

async function currentApiSummary(): Promise<ApiQuotaSummary> {
  if (!process.env.API_FOOTBALL_KEY?.trim()) {
    return emptyApiSummary(
      "NOT_CONFIGURED",
    );
  }

  try {
    const result =
      await apiFootballRequest<ApiFootballStatus>(
        "status",
      );

    return summarizeApiQuota(
      result.response,
    );
  } catch (error: unknown) {
    console.warn(
      "API-Football status could not be refreshed:",
      error instanceof Error
        ? error.message
        : error,
    );

    return emptyApiSummary(
      "UNAVAILABLE",
    );
  }
}

export async function generateProductionDataCoverageSnapshot(
  generatedAt = new Date(),
): Promise<ProductionDataCoverageSnapshot> {
  const [
    databaseMatches,
    predictions,
    api,
  ] = await Promise.all([
    prisma.match.findMany({
      where: {
        season: {
          year:
            ACTIVE_SEASON_YEAR,
        },
      },
      select: {
        id: true,
        status: true,
        homeScore: true,
        awayScore: true,
        updatedAt: true,
        season: {
          select: {
            league: {
              select: {
                apiId: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    loadDashboardPredictionSnapshot(
      5_000,
    ),
    currentApiSummary(),
  ]);

  const publishedMatchIds =
    new Set(
      predictions.map(
        (prediction) =>
          prediction.matchId,
      ),
    );

  const matches: CoverageMatch[] =
    databaseMatches.map(
      (match) => ({
        id: match.id,
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        updatedAt: match.updatedAt,
        leagueApiId:
          match.season.league.apiId,
        leagueName:
          match.season.league.name,
      }),
    );

  const leagues =
    summarizeLeagueCoverage(
      matches,
      publishedMatchIds,
    );

  const snapshot:
    ProductionDataCoverageSnapshot = {
      schemaVersion:
        COVERAGE_SCHEMA_VERSION,
      generatedAt:
        generatedAt.toISOString(),
      seasonYear:
        ACTIVE_SEASON_YEAR,
      api,
      totals:
        totalCoverage(leagues),
      leagues,
      production: {
        champion:
          "20% ML / 80% Poisson",
        automaticModelChangeAllowed:
          false,
        secretsStored:
          false,
      },
    };

  await saveProductionDataCoverageSnapshot(
    snapshot,
  );

  return snapshot;
}
