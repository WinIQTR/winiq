import "dotenv/config";

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

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "TOP PICKS ENGINE V1 TEST",
  );

  console.log(
    "========================================",
  );

  const match =
    await prisma.match.findFirst({
      where: {
        status:
          "FINISHED",

        season: {
          year:
            2024,

          league: {
            apiId:
              39,
          },
        },
      },

      orderBy: {
        kickoffAt:
          "desc",
      },

      select: {
        id:
          true,

        kickoffAt:
          true,

        homeTeam: {
          select: {
            name:
              true,
          },
        },

        awayTeam: {
          select: {
            name:
              true,
          },
        },
      },
    });

  if (!match) {
    throw new Error(
      "Test maçı bulunamadı.",
    );
  }

  console.log("");
  console.log(
    `Maç: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );

  console.log(
    `Tarih: ${match.kickoffAt.toISOString()}`,
  );

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
      },
    );

  console.log("");
  console.log(
    "SUMMARY",
  );

  console.table({
    matchId:
      topPicks.matchId,

    markets:
      topPicks
        .consideredSelections,

    eligible:
      topPicks
        .eligibleSelections,

    picks:
      topPicks
        .picks
        .length,

    model:
      topPicks
        .model
        .version,
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

        historical:
          pick
            .historicalHitRate,

        thresholdHit:
          pick
            .thresholdHitRate,

        thresholdSamples:
          pick
            .thresholdSamples,

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
    "DETAILS",
  );

  for (
    const pick
    of topPicks.picks
  ) {
    console.log("");
    console.log(
      `#${pick.rank} ${pick.market} • ${pick.selection}`,
    );

    console.log(
      `Probability: ${pick.probability}%`,
    );

    console.log(
      `Reliability: ${pick.reliabilityScore}/100 • ${pick.tier}`,
    );

    console.log(
      `Pick Score: ${pick.pickScore}`,
    );

    for (
      const reason
      of pick.reasons
    ) {
      console.log(
        `  • ${reason}`,
      );
    }
  }

  if (
    topPicks.warnings.length >
    0
  ) {
    console.log("");
    console.log(
      "WARNINGS",
    );

    for (
      const warning
      of topPicks.warnings
    ) {
      console.log(
        `• ${warning}`,
      );
    }
  }

  console.log("");
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