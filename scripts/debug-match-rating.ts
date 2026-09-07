import { prisma } from "@/lib/prisma";

import {
  calculateMatchRating,
} from "@/modules/rating-engine";

async function main() {
  const match = await prisma.match.findFirst({
    where: {
      status: "FINISHED",

      kickoffAt: {
        gte: new Date(
          "2024-10-01T00:00:00.000Z",
        ),
      },

      season: {
        year: 2024,

        league: {
          apiId: 39,
        },
      },
    },

    include: {
      homeTeam: true,
      awayTeam: true,
    },

    orderBy: {
      kickoffAt: "asc",
    },
  });

  if (!match) {
    throw new Error(
      "Test edilecek maç bulunamadı.",
    );
  }

  console.log("\n==============================");
  console.log("MATCH");
  console.log("==============================");

  console.log({
    id: match.id,
    date: match.kickoffAt,
    home: match.homeTeam.name,
    away: match.awayTeam.name,
  });

  const rating =
    await calculateMatchRating(match.id);

  console.log("\n==============================");
  console.log("HOME");
  console.log("==============================");

  console.log({
    team: rating.home.teamName,

    overall:
      rating.home.overall,

    attack:
      rating.home.attack,

    defense:
      rating.home.defense,

    form:
      rating.home.form,

    fitness:
      rating.home.fitness,

    confidence:
      rating.home.confidenceScore,

    calculationRunId:
      rating.home.calculationRunId,
  });

  console.table(
    rating.home.categories.map(
      (category) => ({
        category:
          category.category,

        score:
          category.score,

        confidence:
          category.confidenceScore,

        configured:
          category.configuredFeatureCount,

        used:
          category.usedFeatureCount,

        missing:
          category.missingFeatureCount,
      }),
    ),
  );

  console.log("\n==============================");
  console.log("AWAY");
  console.log("==============================");

  console.log({
    team: rating.away.teamName,

    overall:
      rating.away.overall,

    attack:
      rating.away.attack,

    defense:
      rating.away.defense,

    form:
      rating.away.form,

    fitness:
      rating.away.fitness,

    confidence:
      rating.away.confidenceScore,

    calculationRunId:
      rating.away.calculationRunId,
  });

  console.table(
    rating.away.categories.map(
      (category) => ({
        category:
          category.category,

        score:
          category.score,

        confidence:
          category.confidenceScore,

        configured:
          category.configuredFeatureCount,

        used:
          category.usedFeatureCount,

        missing:
          category.missingFeatureCount,
      }),
    ),
  );

  console.log("\n==============================");
  console.log("MATCH RATING");
  console.log("==============================");

  console.log({
    difference:
      rating.ratingDifference,

    confidence:
      rating.combinedConfidenceScore,

    edge:
      rating.edge,
  });

  const runCounts =
    await prisma.matchFeatureValue.groupBy({
      by: [
        "calculationRunId",
      ],

      where: {
        matchId: match.id,
      },

      _count: {
        _all: true,
      },
    });

  console.log("\n==============================");
  console.log("FEATURE RUNS FOR THIS MATCH");
  console.log("==============================");

  console.table(
    runCounts.map((run) => ({
      calculationRunId:
        run.calculationRunId,

      count:
        run._count._all,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });