import "dotenv/config";

import {
  readFile,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import type {
  SeasonProbabilityBacktestResult,
} from "../src/modules/probability-backtest-engine";

import {
  buildCalibrationProfile,
} from "../src/modules/calibration-engine";

async function main(): Promise<void> {
  const reportPath = path.resolve(
    "reports",
    "premier-league-2024-probability-backtest.json",
  );

  console.log("Backtest raporu okunuyor...");
  console.log(reportPath);

  const reportContent = await readFile(
    reportPath,
    "utf8",
  );

  const report = JSON.parse(
    reportContent,
  ) as SeasonProbabilityBacktestResult;

  console.log(
    "Kalibrasyon profili oluşturuluyor...",
  );

  const profile = buildCalibrationProfile({
    result: report,
    priorStrength: 20,
    minimumReliableSampleSize: 40,
  });

  const outputPath = path.resolve(
    "reports",
    "premier-league-2024-calibration-profile.json",
  );

  await writeFile(
    outputPath,
    JSON.stringify(profile, null, 2),
    "utf8",
  );

  console.log(
    "\nKALİBRASYON PROFİLİ OLUŞTURULDU\n",
  );

  console.log({
    profileName: profile.profileName,
    version: profile.version,
    leagueApiId: profile.leagueApiId,
    seasonYear: profile.seasonYear,
    sourceModel: profile.sourceModelVersion,
    priorStrength: profile.priorStrength,
    minimumReliableSampleSize:
      profile.minimumReliableSampleSize,
    homeBaseRate:
      profile.outcomes.HOME.baseRatePercentage,
    drawBaseRate:
      profile.outcomes.DRAW.baseRatePercentage,
    awayBaseRate:
      profile.outcomes.AWAY.baseRatePercentage,
  });

  console.log(
    `\nProfil kaydedildi:\n${outputPath}`,
  );
}

main().catch((error: unknown) => {
  console.error(
    "Kalibrasyon profili oluşturulamadı:",
  );

  console.error(error);

  process.exitCode = 1;
});