import {
  MatchStatus,
} from "@/generated/prisma/client";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import {
  calculateMarketsFromGoalModel,
} from "@/modules/market-engine";

import {
  rankTopPicks,
} from "@/modules/top-picks-engine";

import type {
  GenerateUpcomingPredictionsOptions,
  UpcomingPredictionMatch,
  UpcomingPredictionsResult,
} from "./types";

const DEFAULT_DAYS_AHEAD =
  7;

const DEFAULT_PICKS_PER_MATCH =
  10;

function addDays(
  date: Date,
  days: number,
): Date {
  const result =
    new Date(
      date,
    );

  result.setUTCDate(
    result.getUTCDate() +
      days,
  );

  return result;
}

function resolveDateRange(
  options?:
    GenerateUpcomingPredictionsOptions,
): {
  from: Date;
  to: Date;
} {
  const from =
    options?.from ??
    new Date();

  if (
    Number.isNaN(
      from.getTime(),
    )
  ) {
    throw new Error(
      "Geçersiz başlangıç tarihi.",
    );
  }

  let to:
    Date;

  if (
    options?.to
  ) {
    to =
      options.to;
  } else {
    const daysAhead =
      options?.daysAhead ??
      DEFAULT_DAYS_AHEAD;

    if (
      !Number.isFinite(
        daysAhead,
      ) ||
      daysAhead <= 0
    ) {
      throw new Error(
        "daysAhead pozitif olmalıdır.",
      );
    }

    to =
      addDays(
        from,
        daysAhead,
      );
  }

  if (
    Number.isNaN(
      to.getTime(),
    )
  ) {
    throw new Error(
      "Geçersiz bitiş tarihi.",
    );
  }

  if (
    to <=
    from
  ) {
    throw new Error(
      "Bitiş tarihi başlangıç tarihinden sonra olmalıdır.",
    );
  }

  return {
    from,
    to,
  };
}

function resolveLeagueApiIds(
  options?:
    GenerateUpcomingPredictionsOptions,
): number[] {
  if (
    options?.leagueApiIds &&
    options.leagueApiIds.length >
      0
  ) {
    return [
      ...new Set(
        options.leagueApiIds,
      ),
    ];
  }

  return ACTIVE_COMPETITIONS.map(
    (
      competition,
    ) =>
      competition.apiId,
  );
}

export async function generateUpcomingPredictions(
  options?:
    GenerateUpcomingPredictionsOptions,
): Promise<UpcomingPredictionsResult> {
  const {
    from,
    to,
  } =
    resolveDateRange(
      options,
    );

  const leagueApiIds =
    resolveLeagueApiIds(
      options,
    );

  const picksPerMatch =
    options
      ?.picksPerMatch ??
    DEFAULT_PICKS_PER_MATCH;

  if (
    !Number.isInteger(
      picksPerMatch,
    ) ||
    picksPerMatch <=
      0
  ) {
    throw new Error(
      "picksPerMatch pozitif bir tam sayı olmalıdır.",
    );
  }

  const limitMatches =
    options?.limitMatches;

  if (
    limitMatches !==
      undefined &&
    (
      !Number.isInteger(
        limitMatches,
      ) ||
      limitMatches <=
        0
    )
  ) {
    throw new Error(
      "limitMatches pozitif bir tam sayı olmalıdır.",
    );
  }

  const databaseMatches =
    await prisma.match.findMany({
      where: {
        status:
          MatchStatus.SCHEDULED,

        kickoffAt: {
          gte:
            from,

          lt:
            to,
        },

        season: {
          league: {
            apiId: {
              in:
                leagueApiIds,
            },
          },
        },
      },

      select: {
        id:
          true,

        apiId:
          true,

        kickoffAt:
          true,

        season: {
          select: {
            id:
              true,

            year:
              true,

            league: {
              select: {
                id:
                  true,

                apiId:
                  true,

                name:
                  true,
              },
            },
          },
        },

        homeTeam: {
          select: {
            id:
              true,

            apiId:
              true,

            name:
              true,
          },
        },

        awayTeam: {
          select: {
            id:
              true,

            apiId:
              true,

            name:
              true,
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      ...(limitMatches
        ? {
            take:
              limitMatches,
          }
        : {}),
    });

  const matches:
    UpcomingPredictionMatch[] =
      [];

  let predictionsReady =
    0;

  let predictionsFailed =
    0;

  for (
    const match
    of databaseMatches
  ) {
    try {
      const goalModel =
        await calculateGoalProbabilities(
          match.id,
        );

      const marketModel =
        calculateMarketsFromGoalModel(
          goalModel,
        );

      const topPicks =
        rankTopPicks(
          marketModel,
          {
            limit:
              picksPerMatch,

            minimumProbability:
              options
                ?.minimumPickProbability ??
              60,

            minimumHistoricalSamples:
              options
                ?.minimumHistoricalSamples ??
              300,

            minimumFairOdds:
              options
                ?.minimumFairOdds ??
              1.05,

            maximumFairOdds:
              options
                ?.maximumFairOdds ??
              5,

            maximumSelectionsPerMarket:
              1,

            maximumSelectionsPerFamily:
              2,
          },
        );

      predictionsReady +=
        1;

      matches.push({
        matchId:
          match.id,

        apiId:
          match.apiId,

        kickoffAt:
          match.kickoffAt,

        league: {
          id:
            match
              .season
              .league
              .id,

          apiId:
            match
              .season
              .league
              .apiId,

          name:
            match
              .season
              .league
              .name,
        },

        season: {
          id:
            match
              .season
              .id,

          year:
            match
              .season
              .year,
        },

        homeTeam: {
          id:
            match
              .homeTeam
              .id,

          apiId:
            match
              .homeTeam
              .apiId,

          name:
            match
              .homeTeam
              .name,
        },

        awayTeam: {
          id:
            match
              .awayTeam
              .id,

          apiId:
            match
              .awayTeam
              .apiId,

          name:
            match
              .awayTeam
              .name,
        },

        predictionStatus:
          "READY",

        expectedGoals: {
          home:
            goalModel
              .expectedGoals
              .home,

          away:
            goalModel
              .expectedGoals
              .away,
        },

        outcomeProbabilities: {
          home:
            goalModel
              .outcomeProbabilities
              .home,

          draw:
            goalModel
              .outcomeProbabilities
              .draw,

          away:
            goalModel
              .outcomeProbabilities
              .away,
        },

        topPicks:
          topPicks.picks,

        marketCount:
          marketModel
            .selections
            .length,

        goalModel,

        marketModel,

        warnings: [
          ...goalModel.warnings,
          ...topPicks.warnings,
        ],

        error:
          null,
      });
    } catch (
      error
    ) {
      predictionsFailed +=
        1;

      matches.push({
        matchId:
          match.id,

        apiId:
          match.apiId,

        kickoffAt:
          match.kickoffAt,

        league: {
          id:
            match
              .season
              .league
              .id,

          apiId:
            match
              .season
              .league
              .apiId,

          name:
            match
              .season
              .league
              .name,
        },

        season: {
          id:
            match
              .season
              .id,

          year:
            match
              .season
              .year,
        },

        homeTeam: {
          id:
            match
              .homeTeam
              .id,

          apiId:
            match
              .homeTeam
              .apiId,

          name:
            match
              .homeTeam
              .name,
        },

        awayTeam: {
          id:
            match
              .awayTeam
              .id,

          apiId:
            match
              .awayTeam
              .apiId,

          name:
            match
              .awayTeam
              .name,
        },

        predictionStatus:
          "FAILED",

        expectedGoals:
          null,

        outcomeProbabilities:
          null,

        topPicks:
          [],

        marketCount:
          0,

        goalModel:
          null,

        marketModel:
          null,

        warnings:
          [],

        error:
          error instanceof Error
            ? error.message
            : "Bilinmeyen tahmin hatası.",
      });
    }
  }

  const warnings:
    string[] = [];

  if (
    databaseMatches.length ===
    0
  ) {
    warnings.push(
      [
        "Belirlenen tarih aralığında SCHEDULED maç bulunamadı.",
        "Yeni sezon fixture verilerinin import edildiğini kontrol et.",
      ].join(" "),
    );
  }

  if (
    predictionsFailed >
    0
  ) {
    warnings.push(
      `${predictionsFailed} maç için tahmin üretilemedi.`,
    );
  }

  return {
    from,
    to,

    requestedLeagueApiIds:
      leagueApiIds,

    matchesFound:
      databaseMatches.length,

    predictionsReady,

    predictionsFailed,

    matches,

    warnings,
  };
}