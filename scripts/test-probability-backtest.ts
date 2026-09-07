import "dotenv/config";

import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import { prisma } from "../src/lib/prisma";

import { runSeasonProbabilityBacktest } from "../src/modules/probability-backtest-engine";

async function main(): Promise<void> {
  console.log(
    "\nPROBABILITY BACKTEST BAŞLIYOR\n",
  );

  const result =
    await runSeasonProbabilityBacktest({
      leagueApiId: 39,
      seasonYear: 2024,
    });

  console.log("\nGENEL SONUÇ\n");

  console.table([
    {
      model: result.model.version,
      bulunanMaç:
        result.matchesFound,
      işlenenMaç:
        result.matchesProcessed,
      değerlendirilen:
        result.matchesEvaluated,
      tahminsiz:
        result.matchesWithoutPrediction,
      doğru:
        result.correctPredictions,
      yanlış:
        result.incorrectPredictions,
      doğruluk:
        result.overallAccuracyPercentage,
      ortalamaTahmin:
        result.averagePredictedProbability,
      brierScore:
        result.brierScore,
      logLoss:
        result.logLoss,
      hata:
        result.matchesFailed,
    },
  ]);

  console.log(
    "\nEN YÜKSEK TAHMİN YÜZDESİ ARALIKLARI\n",
  );

  console.table(
    result.topPredictionBuckets
      .filter(
        (bucket) =>
          bucket.total > 0,
      )
      .map((bucket) => ({
        aralık: bucket.label,
        toplam: bucket.total,
        doğru: bucket.correct,
        yanlış: bucket.incorrect,
        ortalamaTahmin:
          bucket.averagePredictedProbability,
        gerçekBaşarı:
          bucket.accuracyPercentage,
        kalibrasyonFarkı:
          bucket.calibrationDifference,
      })),
  );

  console.log(
    "\nGÜVEN SEVİYESİ PERFORMANSI\n",
  );

  console.table(
    result.confidencePerformance,
  );

  console.log(
    "\nHOME PAZARI YÜZDE ARALIKLARI\n",
  );

  console.table(
    result.marketBuckets
      .filter(
        (bucket) =>
          bucket.outcome === "HOME" &&
          bucket.total > 0,
      )
      .map((bucket) => ({
        aralık: bucket.label,
        toplam: bucket.total,
        gerçekleşti:
          bucket.occurred,
        gerçekleşmedi:
          bucket.didNotOccur,
        ortalamaTahmin:
          bucket.averagePredictedProbability,
        gerçekOran:
          bucket.actualOccurrencePercentage,
        kalibrasyonFarkı:
          bucket.calibrationDifference,
      })),
  );

  console.log(
    "\nDRAW PAZARI YÜZDE ARALIKLARI\n",
  );

  console.table(
    result.marketBuckets
      .filter(
        (bucket) =>
          bucket.outcome === "DRAW" &&
          bucket.total > 0,
      )
      .map((bucket) => ({
        aralık: bucket.label,
        toplam: bucket.total,
        gerçekleşti:
          bucket.occurred,
        gerçekleşmedi:
          bucket.didNotOccur,
        ortalamaTahmin:
          bucket.averagePredictedProbability,
        gerçekOran:
          bucket.actualOccurrencePercentage,
        kalibrasyonFarkı:
          bucket.calibrationDifference,
      })),
  );

  console.log(
    "\nAWAY PAZARI YÜZDE ARALIKLARI\n",
  );

  console.table(
    result.marketBuckets
      .filter(
        (bucket) =>
          bucket.outcome === "AWAY" &&
          bucket.total > 0,
      )
      .map((bucket) => ({
        aralık: bucket.label,
        toplam: bucket.total,
        gerçekleşti:
          bucket.occurred,
        gerçekleşmedi:
          bucket.didNotOccur,
        ortalamaTahmin:
          bucket.averagePredictedProbability,
        gerçekOran:
          bucket.actualOccurrencePercentage,
        kalibrasyonFarkı:
          bucket.calibrationDifference,
      })),
  );

  const reportsDirectory =
    path.resolve("reports");

  await mkdir(
    reportsDirectory,
    {
      recursive: true,
    },
  );

  const reportPath =
    path.join(
      reportsDirectory,
      "premier-league-2024-probability-backtest.json",
    );

  await writeFile(
    reportPath,
    JSON.stringify(
      result,
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `\nRapor kaydedildi:\n${reportPath}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Probability Backtest başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });