import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

import {
  generateUpcomingPredictions,
} from "@/modules/upcoming-prediction-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "UPCOMING PREDICTIONS V1 TEST",
  );

  console.log(
    "========================================",
  );

  const now =
    new Date();

  console.log("");
  console.log(
    `Now: ${now.toISOString()}`,
  );

  const result =
    await generateUpcomingPredictions({
      from:
        now,

      daysAhead:
        30,

      limitMatches:
        20,

      picksPerMatch:
        10,

      minimumPickProbability:
        60,

      minimumHistoricalSamples:
        300,

      minimumFairOdds:
        1.05,

      maximumFairOdds:
        5,
    });

  console.log("");
  console.log(
    "SUMMARY",
  );

  console.table({
    from:
      result
        .from
        .toISOString(),

    to:
      result
        .to
        .toISOString(),

    leagues:
      result
        .requestedLeagueApiIds
        .length,

    matchesFound:
      result
        .matchesFound,

    ready:
      result
        .predictionsReady,

    failed:
      result
        .predictionsFailed,
  });

  for (
    const match
    of result.matches
  ) {
    console.log("");
    console.log(
      "----------------------------------------",
    );

    console.log(
      `${match.homeTeam.name} - ${match.awayTeam.name}`,
    );

    console.log(
      `${match.league.name} • ${match.kickoffAt.toISOString()}`,
    );

    console.log(
      `Status: ${match.predictionStatus}`,
    );

    if (
      match.error
    ) {
      console.log(
        `Error: ${match.error}`,
      );

      continue;
    }

    if (
      match.expectedGoals
    ) {
      console.log(
        `xG: ${match.expectedGoals.home} - ${match.expectedGoals.away}`,
      );
    }

    if (
      match.outcomeProbabilities
    ) {
      console.log("");
      console.log(
        "1X2",
      );

      console.table({
        HOME:
          match
            .outcomeProbabilities
            .home,

        DRAW:
          match
            .outcomeProbabilities
            .draw,

        AWAY:
          match
            .outcomeProbabilities
            .away,
      });
    }

    console.log("");
    console.log(
      "TOP PICKS",
    );

    console.table(
      match.topPicks.map(
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
  }

  if (
    result.warnings.length >
    0
  ) {
    console.log("");
    console.log(
      "WARNINGS",
    );

    for (
      const warning
      of result.warnings
    ) {
      console.log(
        `• ${warning}`,
      );
    }
  }

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "UPCOMING PREDICTIONS TEST COMPLETE",
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