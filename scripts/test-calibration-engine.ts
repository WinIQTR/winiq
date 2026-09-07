import "dotenv/config";

import {
  readFile,
} from "node:fs/promises";

import path from "node:path";

import type {
  CalibrationProfile,
} from "../src/modules/calibration-engine";

import {
  applyCalibration,
} from "../src/modules/calibration-engine";

async function main(): Promise<void> {
  const profilePath =
    path.resolve(
      "reports",
      "premier-league-2024-calibration-profile.json",
    );

  const profileContent =
    await readFile(
      profilePath,
      "utf8",
    );

  const profile =
    JSON.parse(
      profileContent,
    ) as CalibrationProfile;

  /*
   * Önceki testte yanlış çıkan örneğin
   * ham olasılıkları.
   */
  const result =
    applyCalibration({
      probabilities: {
        home: 3.27,
        draw: 16,
        away: 80.73,
      },

      profile,
    });

  console.log(
    "\nCALIBRATION ENGINE TESTİ\n",
  );

  console.log({
    raw:
      result.rawProbabilities,

    calibrated:
      result.calibratedProbabilities,

    overallReliability:
      result.overallReliabilityScore,

    profileVersion:
      result.profileVersion,
  });

  console.log(
    "\nMARKET DETAYLARI\n",
  );

  console.table(
    Object.values(
      result.details,
    ).map((detail) => ({
      outcome:
        detail.outcome,

      rawProbability:
        detail.rawProbability,

      calibratedProbability:
        detail.calibratedProbability,

      bucket:
        detail.bucketLabel,

      sampleSize:
        detail.sampleSize,

      historicalRate:
        detail.rawHistoricalRate,

      smoothedRate:
        detail.smoothedHistoricalRate,

      reliability:
        detail.reliabilityScore,
    })),
  );

  if (
    result.warnings.length > 0
  ) {
    console.log("\nUYARILAR\n");

    for (
      const warning of result.warnings
    ) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      "Calibration Engine testi başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  },
);