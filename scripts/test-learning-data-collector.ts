import "dotenv/config";

import {
  prisma,
} from "../src/lib/prisma";

import {
  collectTrainingData,
} from "../src/modules/learning-engine";

async function main(): Promise<void> {
  const result =
    await collectTrainingData({
      leagueApiId: 39,
      seasonYear: 2024,

      includeExperimentalFeatures: true,

      /*
       * Şu an eski maç feature'ları sonradan
       * hesaplanmış olabileceğinden false.
       *
       * Canlı PredictionSnapshot sistemi
       * devreye girdikten sonra true yapılacak.
       */
      strictPreMatchOnly: true,

      minimumDataQualityScore: 0,
    });

  console.log(
    "\nLEARNING DATA COLLECTOR TESTİ\n",
  );

  console.log({
    leagueApiId:
      result.leagueApiId,

    seasonYear:
      result.seasonYear,

    totalFinishedMatches:
      result.totalFinishedMatches,

    collectedMatchCount:
      result.collectedMatchCount,

    skippedMatchCount:
      result.skippedMatchCount,

    featureDefinitionCount:
      result.featureKeys.length,

    warningCount:
      result.warnings.length,
  });

  console.log(
    "\nFEATURE KEYS\n",
  );

  console.table(
    result.featureKeys.map(
      (key, index) => ({
        order: index + 1,
        key,
      }),
    ),
  );

  console.log(
    "\nİLK 5 TRAINING ROW\n",
  );

  console.table(
    result.rows
      .slice(0, 5)
      .map((row) => ({
        matchId:
          row.matchId,

        match:
          `${row.homeTeamName} - ${row.awayTeamName}`,

        score:
          `${row.homeScore}-${row.awayScore}`,

        outcome:
          row.actualOutcome,

        available:
          row.availableFeatureCount,

        missing:
          row.missingFeatureCount,

        quality:
          row.averageDataQualityScore,

        postMatchFeatures:
          row
            .containsPostMatchCalculatedFeatures,
      })),
  );

  const firstRow =
    result.rows[0];

  if (firstRow) {
    console.log(
      "\nİLK MAÇ FEATURE VECTOR\n",
    );

    console.log({
      match:
        `${firstRow.homeTeamName} - ${firstRow.awayTeamName}`,

      score:
        `${firstRow.homeScore}-${firstRow.awayScore}`,

      actualOutcome:
        firstRow.actualOutcome,

      features:
        firstRow.features,
    });
  }

  if (result.warnings.length > 0) {
    console.log("\nUYARILAR\n");

    for (
      const warning
      of result.warnings
    ) {
      console.warn(
        `- ${warning}`,
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      "Learning Data Collector testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });