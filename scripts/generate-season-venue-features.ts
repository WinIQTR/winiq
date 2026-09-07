import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { generateMatchFeatures } from "../src/modules/feature-engine/generate-match-features";

async function main(): Promise<void> {
  const matches = await prisma.match.findMany({
    where: {
      season: {
        year: 2024,
        league: {
          apiId: 39,
        },
      },
    },

    orderBy: {
      kickoffAt: "asc",
    },

    select: {
      id: true,
      apiId: true,
      kickoffAt: true,

      homeTeam: {
        select: {
          name: true,
        },
      },

      awayTeam: {
        select: {
          name: true,
        },
      },
    },
  });

  console.log("\nSEASON VENUE FEATURE GENERATION\n");

  console.log({
    leagueApiId: 39,
    seasonYear: 2024,
    matchCount: matches.length,
  });

  let successCount = 0;
  let failedCount = 0;

  const startedAt = Date.now();

  for (
    let index = 0;
    index < matches.length;
    index += 1
  ) {
    const match = matches[index];

    try {
      const result =
        await generateMatchFeatures(
          match.id,
        );

      successCount += 1;

      console.log(
        [
          `[${index + 1}/${matches.length}]`,
          "OK",
          `${result.match.homeTeam} - ${result.match.awayTeam}`,
        ].join(" "),
      );
    } catch (error: unknown) {
      failedCount += 1;

      console.error(
        [
          `[${index + 1}/${matches.length}]`,
          "FAILED",
          `${match.homeTeam.name} - ${match.awayTeam.name}`,
        ].join(" "),
      );

      console.error(error);
    }
  }

  const durationSeconds =
    Math.round(
      (Date.now() - startedAt) / 1000,
    );

  console.log("\nGENERATION SUMMARY\n");

  console.log({
    totalMatches: matches.length,
    successCount,
    failedCount,
    durationSeconds,
  });
}

main()
  .catch((error: unknown) => {
    console.error(
      "Season venue feature generation başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });