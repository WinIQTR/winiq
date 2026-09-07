import "dotenv/config";

import { prisma } from "@/lib/prisma";
import {
  loadDashboardPredictionSnapshot,
  saveDashboardPredictionSnapshot,
} from "@/lib/prediction-dashboard-snapshot";
import { buildPopularMarketsSummary } from "@/modules/market-engine/build-popular-markets-summary";
import { calculateCardsCornersMarkets } from "@/modules/market-engine/calculate-cards-corners-market";

const ADVANCED_LABELS = new Set([
  "Kart Bahisleri",
  "Korner Alt/Üst",
  "Ofsayt Alt/Üst",
  "Şut Alt/Üst",
]);

async function main(): Promise<void> {
  const predictions = await loadDashboardPredictionSnapshot(20_000);
  const now = new Date();
  const upcomingIds = predictions
    .filter((prediction) => prediction.kickoffAt > now)
    .map((prediction) => prediction.matchId);

  const matches = await prisma.match.findMany({
    where: { id: { in: upcomingIds }, status: "SCHEDULED" },
    select: { id: true, homeTeamId: true, awayTeamId: true, seasonId: true },
  });
  const matchById = new Map(matches.map((match) => [match.id, match]));

  let refreshed = 0;
  let withCorners = 0;
  let withCards = 0;
  let withOffsides = 0;
  let withShots = 0;

  const updated = [];
  for (const prediction of predictions) {
    const match = matchById.get(prediction.matchId);
    if (!match || prediction.kickoffAt <= now) {
      updated.push(prediction);
      continue;
    }

    const selections = await calculateCardsCornersMarkets(
      match.homeTeamId,
      match.awayTeamId,
      match.seasonId,
    );
    const advancedRows = buildPopularMarketsSummary(selections)
      .filter((row) => ADVANCED_LABELS.has(row.label));
    const advancedByLabel = new Map(advancedRows.map((row) => [row.label, row]));
    const existing = prediction.popularMarketsSummary ?? [];
    const merged = existing.map((row) => advancedByLabel.get(row.label) ?? row);

    for (const row of advancedRows) {
      if (!merged.some((candidate) => candidate.label === row.label)) merged.push(row);
    }

    refreshed += 1;
    if (advancedByLabel.get("Korner Alt/Üst")?.supported) withCorners += 1;
    if (advancedByLabel.get("Kart Bahisleri")?.supported) withCards += 1;
    if (advancedByLabel.get("Ofsayt Alt/Üst")?.supported) withOffsides += 1;
    if (advancedByLabel.get("Şut Alt/Üst")?.supported) withShots += 1;
    updated.push({ ...prediction, popularMarketsSummary: merged });
  }

  await saveDashboardPredictionSnapshot(updated, new Date(), { mergeExisting: false });

  console.log("\n==============================================");
  console.log("UPCOMING ADVANCED MARKETS REFRESH");
  console.log("==============================================");
  console.table({
    "Yaklaşan tahmin": refreshed,
    "Korner aktif": withCorners,
    "Kart aktif": withCards,
    "Ofsayt aktif": withOffsides,
    "Şut aktif": withShots,
  });
  console.log("MS olasılıkları, yayın kararları ve %20 ML / %80 Poisson ağırlıkları korunmuştur.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
