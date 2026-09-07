import "dotenv/config";

import { ACTIVE_COMPETITIONS } from "@/config/competitions";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { importPlayerMatchPerformances } from "@/modules/importer/football/api-football/import-player-match-performances";
import { importPlayersFromApiFootball } from "@/modules/importer/football/api-football/import-players";

async function main(): Promise<void> {
  if (process.env.CONFIRM_ALL_PLAYER_IMPORT !== "YES") {
    console.log("Güvenli durdurma: API kotasını korumak için CONFIRM_ALL_PLAYER_IMPORT=YES ayarlayın.");
    console.log(`${ACTIVE_COMPETITIONS.length} organizasyon için 2026 kadro ve son maç performansı yenilenecek.`);
    return;
  }

  const maximumMatches = Math.max(1, Number.parseInt(process.env.PLAYER_PERFORMANCE_MATCH_LIMIT ?? "10", 10) || 10);
  const summary: Array<Record<string, string | number>> = [];

  for (const competition of ACTIVE_COMPETITIONS) {
    console.log(`\n${competition.name}: kadro ve sezon istatistikleri alınıyor...`);
    const squad = await importPlayersFromApiFootball(competition.apiId, ACTIVE_SEASON_YEAR);
    const performance = await importPlayerMatchPerformances({
      leagueApiId: competition.apiId,
      seasonYear: ACTIVE_SEASON_YEAR,
      maximumMatches,
      requestDelayMs: 1200,
    });
    summary.push({
      organizasyon: competition.name,
      takım: squad.teamsProcessed,
      oyuncu: squad.uniquePlayers,
      performans: performance.performancesSaved,
      "api isteği": squad.apiRequests + performance.apiRequests,
    });
  }

  console.table(summary);
  console.log("Tüm aktif organizasyonların oyuncu kapsamı yenilendi.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
