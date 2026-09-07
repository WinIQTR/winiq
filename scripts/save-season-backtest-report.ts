import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../src/lib/prisma";
import { runSeasonBacktest } from "../src/modules/backtest-engine";

async function main(): Promise<void> {
  console.log("\nBacktest raporu hazırlanıyor...\n");

  const result = await runSeasonBacktest({
    leagueApiId: 39,
    seasonYear: 2024,
  });

  const reportDirectory = path.resolve("reports");

  await mkdir(reportDirectory, {
    recursive: true,
  });

  const reportPath = path.join(
    reportDirectory,
    "premier-league-2024-backtest.json",
  );

  await writeFile(
    reportPath,
    JSON.stringify(result, null, 2),
    "utf8",
  );

  console.log("GENEL SONUÇ");

  console.table([
    {
      model: result.model.version,
      bulunanMaç: result.matchesFound,
      işlenenMaç: result.matchesProcessed,
      değerlendirilen: result.matchesEvaluated,
      doğru: result.correctPredictions,
      yanlış: result.incorrectPredictions,
      doğruluk: result.overallAccuracyPercentage,
      hata: result.matchesFailed,
    },
  ]);

  console.log("\nEDGE PERFORMANSI");

  console.table(
    result.edgeSummaries.map((item) => ({
      edge: item.edge,
      toplam: item.total,
      doğru: item.correct,
      yanlış: item.incorrect,
      doğruluk: item.accuracyPercentage,
      evGalibiyeti: item.homeWins,
      beraberlik: item.draws,
      deplasmanGalibiyeti: item.awayWins,
      ortalamaFark: item.averageScoreDifference,
      ortalamaGüven: item.averageConfidenceScore,
    })),
  );

  console.log("\nGÜVEN PUANI ARALIKLARI");

  console.table(
    result.confidenceBuckets.map((item) => ({
      aralık: item.label,
      toplam: item.total,
      doğru: item.correct,
      yanlış: item.incorrect,
      doğruluk: item.accuracyPercentage,
    })),
  );

  console.log("\nSKOR FARKI ARALIKLARI");

  console.table(
    result.differenceBuckets.map((item) => ({
      aralık: item.label,
      toplam: item.total,
      doğru: item.correct,
      yanlış: item.incorrect,
      doğruluk: item.accuracyPercentage,
    })),
  );

  console.log(`\nRapor kaydedildi:\n${reportPath}`);
}

main()
  .catch((error: unknown) => {
    console.error("Backtest raporu oluşturulamadı:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });