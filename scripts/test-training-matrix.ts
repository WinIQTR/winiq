import "dotenv/config";

import {
  prisma,
} from "../src/lib/prisma";

import {
  buildTrainingMatrix,
  collectTrainingData,
} from "../src/modules/learning-engine";

async function main(): Promise<void> {
  const collection =
    await collectTrainingData({
      leagueApiId: 39,
      seasonYear: 2024,

      includeExperimentalFeatures:
        true,

      strictPreMatchOnly:
        true,

      minimumDataQualityScore:
        0,
    });

  const matrix =
    buildTrainingMatrix(
      collection.rows,
      {
        includeSideFeatures: true,

        includeDifferenceFeatures:
          true,

        missingValueStrategy:
          "COLUMN_MEAN",

        maximumMissingRatio:
          0.5,
      },
    );

  console.log(
    "\nTRAINING MATRIX TESTİ\n",
  );

  console.log({
    collectedMatchCount:
      collection.collectedMatchCount,

    rowCount:
      matrix.rowCount,

    columnCount:
      matrix.columnCount,

    skippedRowCount:
      matrix.skippedRowCount,

    imputedValueCount:
      matrix.imputedValueCount,

    missingValueStrategy:
      matrix.missingValueStrategy,

    warningCount:
      matrix.warnings.length,
  });

  console.log(
    "\nMATRIX FEATURE COLUMNS\n",
  );

  console.table(
    matrix.featureNames.map(
      (featureName, index) => ({
        columnIndex: index,
        featureName,
        columnMean:
          matrix.columnMeans[
            featureName
          ],
      }),
    ),
  );

  console.log(
    "\nİLK 5 MATRIX ROW\n",
  );

  console.table(
    matrix.X
      .slice(0, 5)
      .map((values, index) => {
        const row =
          matrix.metadata[index];

        return {
          match:
            `${row.homeTeamName} - ${row.awayTeamName}`,

          outcome:
            row.actualOutcome,

          targetClass:
            matrix.y[index],

          oneHot:
            JSON.stringify(
              matrix.yOneHot[index],
            ),

          featureCount:
            values.length,
        };
      }),
  );

  console.log(
    "\nİLK MATRIX VECTOR\n",
  );

  const firstVector =
    matrix.X[0];

  console.table(
    matrix.featureNames.map(
      (featureName, index) => ({
        featureName,
        value:
          firstVector[index],
      }),
    ),
  );

  if (matrix.warnings.length > 0) {
    console.log("\nUYARILAR\n");

    for (
      const warning
      of matrix.warnings
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
      "Training Matrix testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });