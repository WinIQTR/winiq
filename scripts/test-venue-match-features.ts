import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { generateMatchFeatures } from "../src/modules/feature-engine/generate-match-features";

async function main(): Promise<void> {
  const match = await prisma.match.findFirst({
    where: {
      status: "FINISHED",
    },
    orderBy: {
  kickoffAt: "desc",
},
    select: {
      id: true,
      apiId: true,
      kickoffAt: true,
    },
  });

  if (!match) {
    throw new Error("Test için bitmiş maç bulunamadı.");
  }

  const result = await generateMatchFeatures(
    match.id,
  );

  console.log(
    "\nVENUE MATCH FEATURE TESTİ\n",
  );

  console.log({
    matchId: result.match.id,
    apiId: result.match.apiId,
    match: `${result.match.homeTeam} - ${result.match.awayTeam}`,
    kickoffAt: result.match.kickoffAt,
    calculationRunId: result.calculationRunId,
  });

  console.log("\nHOME FEATURES\n");

  console.table(
    result.home.values.map((feature) => ({
      key: feature.key,
      rawValue: feature.rawValue,
      normalizedValue:
        feature.normalizedValue,
      dataQualityScore:
        feature.dataQualityScore,
    })),
  );

  console.log("\nAWAY FEATURES\n");

  console.table(
    result.away.values.map((feature) => ({
      key: feature.key,
      rawValue: feature.rawValue,
      normalizedValue:
        feature.normalizedValue,
      dataQualityScore:
        feature.dataQualityScore,
    })),
  );

  const expectedVenueKeys = [
    "venue_last_5_points_per_game",
    "venue_goals_scored_per_game",
    "venue_goals_conceded_per_game",
  ];

  const homeKeys = new Set(
    result.home.values.map(
      (feature) => feature.key,
    ),
  );

  const awayKeys = new Set(
    result.away.values.map(
      (feature) => feature.key,
    ),
  );

  const missingHomeKeys =
    expectedVenueKeys.filter(
      (key) => !homeKeys.has(key),
    );

  const missingAwayKeys =
    expectedVenueKeys.filter(
      (key) => !awayKeys.has(key),
    );

  console.log("\nKONTROL\n");

  console.log({
    homeVenueFeaturesPresent:
      missingHomeKeys.length === 0,

    awayVenueFeaturesPresent:
      missingAwayKeys.length === 0,

    missingHomeKeys,
    missingAwayKeys,
  });
}

main()
  .catch((error: unknown) => {
    console.error(
      "Venue match feature testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });