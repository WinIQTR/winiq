import "dotenv/config";

import { MatchStatus } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { calculateMatchRating } from "../src/modules/rating-engine";

async function main(): Promise<void> {
  const match =
    await prisma.match.findFirst({
      where: {
        status:
          MatchStatus.FINISHED,

        season: {
          year: 2024,

          league: {
            apiId: 39,
          },
        },
      },

      orderBy: {
        kickoffAt: "desc",
      },
    });

  if (!match) {
    throw new Error(
      "Rating testi için maç bulunamadı.",
    );
  }

  const result =
    await calculateMatchRating(
      match.id,
    );

  console.log(
    "\nRATING ENGINE TESTİ\n",
  );

  console.log({
    match:
      `${result.match.homeTeam} - ${result.match.awayTeam}`,

    actualScore:
      `${result.match.actualHomeScore} - ${result.match.actualAwayScore}`,

    homeOverall:
      result.home.overall,

    awayOverall:
      result.away.overall,

    ratingDifference:
      result.ratingDifference,

    combinedConfidence:
      result.combinedConfidenceScore,

    edge: result.edge,
  });

  console.log(
    "\nEV SAHİBİ RATING\n",
  );

  console.log({
    team: result.home.teamName,
    attack: result.home.attack,
    defense: result.home.defense,
    form: result.home.form,
    fitness: result.home.fitness,
    overall: result.home.overall,
    confidence:
      result.home.confidenceScore,
  });

  console.table(
    result.home.categories.map(
      (category) => ({
        category:
          category.category,

        score: category.score,

        confidence:
          category.confidenceScore,

        configuredFeatures:
          category.configuredFeatureCount,

        usedFeatures:
          category.usedFeatureCount,

        missingFeatures:
          category.missingFeatureCount,

        coverage:
          category.coveragePercentage,
      }),
    ),
  );

  console.log(
    "\nDEPLASMAN RATING\n",
  );

  console.log({
    team: result.away.teamName,
    attack: result.away.attack,
    defense: result.away.defense,
    form: result.away.form,
    fitness: result.away.fitness,
    overall: result.away.overall,
    confidence:
      result.away.confidenceScore,
  });

  console.table(
    result.away.categories.map(
      (category) => ({
        category:
          category.category,

        score: category.score,

        confidence:
          category.confidenceScore,

        configuredFeatures:
          category.configuredFeatureCount,

        usedFeatures:
          category.usedFeatureCount,

        missingFeatures:
          category.missingFeatureCount,

        coverage:
          category.coveragePercentage,
      }),
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Rating Engine testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });