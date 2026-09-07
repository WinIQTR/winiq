import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { runSeasonBacktest } from "../src/modules/backtest-engine";

async function main(): Promise<void> {
  console.log("\nSEZON BACKTEST BAŞLIYOR\n");

  const result = await runSeasonBacktest({
    leagueApiId: 39,
    seasonYear: 2024,
  });

  console.log("\nGENEL SONUÇ\n");

  console.log({
    model: result.model,
    matchesFound: result.matchesFound,
    matchesProcessed: result.matchesProcessed,
    matchesEvaluated: result.matchesEvaluated,
    matchesSkipped: result.matchesSkipped,
    matchesFailed: result.matchesFailed,
    correctPredictions: result.correctPredictions,
    incorrectPredictions:
      result.incorrectPredictions,
    overallAccuracyPercentage:
      result.overallAccuracyPercentage,
    actualHomeWins: result.actualHomeWins,
    actualDraws: result.actualDraws,
    actualAwayWins: result.actualAwayWins,
  });

  console.log("\nEDGE PERFORMANSI\n");
  console.table(result.edgeSummaries);

  console.log("\nGÜVEN PUANI ARALIKLARI\n");
  console.table(result.confidenceBuckets);

  console.log("\nSKOR FARKI ARALIKLARI\n");
  console.table(result.differenceBuckets);

  console.log("\nEN YÜKSEK SKOR FARKLI 20 MAÇ\n");

  console.table(
    result.matches
      .filter(
        (match) =>
          match.scoreDifference !== null &&
          match.predictedResult !== null,
      )
      .sort(
        (a, b) =>
          Math.abs(b.scoreDifference ?? 0) -
          Math.abs(a.scoreDifference ?? 0),
      )
      .slice(0, 20)
      .map((match) => ({
        match:
          `${match.homeTeam} - ${match.awayTeam}`,
        actualScore: match.actualScore,
        actualResult: match.actualResult,
        predictedResult: match.predictedResult,
        difference: match.scoreDifference,
        confidence: match.confidenceScore,
        edge: match.edge,
        correct: match.isCorrect,
      })),
  );

  if (result.failures.length > 0) {
    console.log("\nHATALAR\n");
    console.table(result.failures.slice(0, 20));
  }
}

main()
  .catch((error: unknown) => {
    console.error("Sezon backtest testi başarısız:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });