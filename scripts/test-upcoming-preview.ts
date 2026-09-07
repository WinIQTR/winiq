import "dotenv/config";

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

const SEASON_YEAR =
  2024;

const MATCH_LIMIT =
  10;

function determineActualOutcome(
  homeScore: number,
  awayScore: number,
):
  | "HOME"
  | "DRAW"
  | "AWAY" {
  if (
    homeScore >
    awayScore
  ) {
    return "HOME";
  }

  if (
    awayScore >
    homeScore
  ) {
    return "AWAY";
  }

  return "DRAW";
}

function determinePredictedOutcome(
  probabilities: {
    home: number;
    draw: number;
    away: number;
  },
):
  | "HOME"
  | "DRAW"
  | "AWAY" {
  if (
    probabilities.home >=
      probabilities.draw &&
    probabilities.home >=
      probabilities.away
  ) {
    return "HOME";
  }

  if (
    probabilities.draw >=
      probabilities.home &&
    probabilities.draw >=
      probabilities.away
  ) {
    return "DRAW";
  }

  return "AWAY";
}

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "UPCOMING PREDICTION HISTORICAL PREVIEW",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    "Bu mod veritabanını değiştirmez.",
  );

  console.log(
    "Bitmiş maçları maç öncesi tahmin testi gibi gösterir.",
  );

  console.log("");

  const leagueApiIds =
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) =>
        competition.apiId,
    );

  /*
   * Sezonun son maçlarından örnek alıyoruz.
   *
   * calculateGoalProbabilities zaten
   * sadece kickoffAt öncesindeki maçları
   * kullandığı için gerçek sonucu model
   * inputuna sızdırmıyoruz.
   */
  const matches =
    await prisma.match.findMany({
      where: {
        status:
          "FINISHED",

        homeScore: {
          not:
            null,
        },

        awayScore: {
          not:
            null,
        },

        season: {
          year:
            SEASON_YEAR,

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

        round:
          true,

        homeScore:
          true,

        awayScore:
          true,

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

        season: {
          select: {
            year:
              true,

            league: {
              select: {
                apiId:
                  true,

                name:
                  true,
              },
            },
          },
        },
      },

      orderBy: {
        kickoffAt:
          "desc",
      },

      take:
        MATCH_LIMIT,
    });

  console.log(
    `Preview maç: ${matches.length}`,
  );

  let ready =
    0;

  let failed =
    0;

  let predictedCorrect =
    0;

  for (
    let index = 0;
    index <
    matches.length;
    index += 1
  ) {
    const match =
      matches[index];

    console.log("");
    console.log(
      "========================================",
    );

    console.log(
      `[${index + 1}/${matches.length}] ${match.homeTeam.name} - ${match.awayTeam.name}`,
    );

    console.log(
      `${match.season.league.name} • ${match.kickoffAt.toISOString()}`,
    );

    if (
      match.round
    ) {
      console.log(
        `Round: ${match.round}`,
      );
    }

    try {
      const goalModel =
        await calculateGoalProbabilities(
          match.id,
        );

      const markets =
        calculateMarketsFromGoalModel(
          goalModel,
        );

      const topPicks =
        rankTopPicks(
          markets,
          {
            limit:
              10,

            minimumProbability:
              60,

            minimumHistoricalSamples:
              300,

            minimumFairOdds:
              1.05,

            maximumFairOdds:
              5,

            maximumSelectionsPerMarket:
              1,

            maximumSelectionsPerFamily:
              2,
          },
        );

      const predictedOutcome =
        determinePredictedOutcome(
          goalModel
            .outcomeProbabilities,
        );

      if (
        match.homeScore ===
          null ||
        match.awayScore ===
          null
      ) {
        throw new Error(
          "Maç sonucu bulunamadı.",
        );
      }

      const actualOutcome =
        determineActualOutcome(
          match.homeScore,
          match.awayScore,
        );

      const isCorrect =
        predictedOutcome ===
        actualOutcome;

      if (
        isCorrect
      ) {
        predictedCorrect +=
          1;
      }

      ready +=
        1;

      console.log("");
      console.log(
        "PRE-MATCH PREDICTION",
      );

      console.table({
        HOME:
          goalModel
            .outcomeProbabilities
            .home,

        DRAW:
          goalModel
            .outcomeProbabilities
            .draw,

        AWAY:
          goalModel
            .outcomeProbabilities
            .away,
      });

      console.log("");
      console.log(
        "EXPECTED GOALS",
      );

      console.table({
        HOME:
          goalModel
            .expectedGoals
            .home,

        AWAY:
          goalModel
            .expectedGoals
            .away,
      });

      console.log("");
      console.log(
        "TOP PICKS",
      );

      console.table(
        topPicks.picks.map(
          (
            pick,
          ) => ({
            rank:
              pick.rank,

            market:
              pick.market,

            selection:
              pick.selection,

            probability:
              pick.probability,

            fairOdds:
              pick.fairOdds,

            reliability:
              pick
                .reliabilityScore,

            pickScore:
              pick.pickScore,

            tier:
              pick.tier,
          }),
        ),
      );

      console.log("");
      console.log(
        "ACTUAL RESULT",
      );

      console.table({
        score:
          `${match.homeScore}-${match.awayScore}`,

        predicted:
          predictedOutcome,

        actual:
          actualOutcome,

        correct:
          isCorrect
            ? "YES"
            : "NO",
      });
    } catch (
      error
    ) {
      failed +=
        1;

      console.log("");
      console.log(
        "FAILED",
      );

      console.log(
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "PREVIEW SUMMARY",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    matches:
      matches.length,

    ready,

    failed,

    "1X2 correct":
      predictedCorrect,

    "1X2 accuracy":
      ready >
      0
        ? Number(
            (
              predictedCorrect /
              ready *
              100
            ).toFixed(
              2,
            ),
          )
        : 0,
  });

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "HISTORICAL PREVIEW COMPLETE",
  );

  console.log(
    "========================================",
  );
}

main()
  .catch(
    (
      error:
        unknown,
    ) => {
      console.error("");

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );