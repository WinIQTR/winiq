import "dotenv/config";

import {
  prisma,
} from "../src/lib/prisma";

import {
  buildTrainingMatrix,
  collectTrainingData,
  splitTrainingValidationChronologically,
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
        includeSideFeatures:
          true,

        includeDifferenceFeatures:
          true,

        missingValueStrategy:
          "COLUMN_MEAN",

        maximumMissingRatio:
          0.5,
      },
    );

  const split =
    splitTrainingValidationChronologically(
      matrix,
      {
        trainingPercentage:
          70,

        minimumTrainingRows:
          200,

        minimumValidationRows:
          80,
      },
    );

  console.log(
    "\nCHRONOLOGICAL TRAIN / VALIDATION SPLIT TESTİ\n",
  );

  console.log({
    totalRowCount:
      split.totalRowCount,

    trainingRowCount:
      split.training.rowCount,

    validationRowCount:
      split.validation.rowCount,

    trainingPercentage:
      split.trainingPercentage,

    validationPercentage:
      split.validationPercentage,

    splitIndex:
      split.splitIndex,

    splitDate:
      split.splitDate,

    warningCount:
      split.warnings.length,
  });

  console.log(
    "\nTRAINING RANGE\n",
  );

  console.log({
    startedAt:
      split.training.startedAt,

    endedAt:
      split.training.endedAt,

    firstMatch:
      [
        split.training
          .metadata[0]
          .homeTeamName,

        split.training
          .metadata[0]
          .awayTeamName,
      ].join(" - "),

    lastMatch:
      [
        split.training
          .metadata[
            split.training
              .metadata.length - 1
          ]
          .homeTeamName,

        split.training
          .metadata[
            split.training
              .metadata.length - 1
          ]
          .awayTeamName,
      ].join(" - "),
  });

  console.log(
    "\nVALIDATION RANGE\n",
  );

  console.log({
    startedAt:
      split.validation.startedAt,

    endedAt:
      split.validation.endedAt,

    firstMatch:
      [
        split.validation
          .metadata[0]
          .homeTeamName,

        split.validation
          .metadata[0]
          .awayTeamName,
      ].join(" - "),

    lastMatch:
      [
        split.validation
          .metadata[
            split.validation
              .metadata.length - 1
          ]
          .homeTeamName,

        split.validation
          .metadata[
            split.validation
              .metadata.length - 1
          ]
          .awayTeamName,
      ].join(" - "),
  });

  console.log(
    "\nFEATURE COLUMNS\n",
  );

  console.table(
    split.training
      .featureNames
      .map(
        (
          featureName,
          index,
        ) => ({
          index,
          featureName,
        }),
      ),
  );

  if (
    split.warnings.length > 0
  ) {
    console.log("\nUYARILAR\n");

    for (
      const warning
      of split.warnings
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
      "Training split testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });