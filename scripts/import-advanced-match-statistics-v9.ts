import "dotenv/config";

import { ACTIVE_COMPETITIONS } from "@/config/competitions";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { importMatchTeamStatistics } from "@/modules/importer/football/api-football/import-match-team-statistics";
import { prisma } from "@/lib/prisma";

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDate(value: string | undefined, fallback: string, endOfDay = false): Date {
  const normalized = value?.trim() || fallback;
  const date = new Date(`${normalized}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Geçersiz tarih: ${normalized}. YYYY-MM-DD kullanın.`);
  }
  return date;
}

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const from = parseDate(process.env.MATCH_STATS_FROM, `${ACTIVE_SEASON_YEAR}-08-15`);
  const to = parseDate(process.env.MATCH_STATS_TO, today, true);
  const totalLimit = Math.min(
    parsePositiveInteger(process.env.MATCH_STATS_MATCH_LIMIT, 250),
    1_000,
  );

  console.log("\n==============================================");
  console.log("V9.5.4 ADVANCED MATCH STATISTICS IMPORT");
  console.log("==============================================");
  console.table({
    Sezon: ACTIVE_SEASON_YEAR,
    Başlangıç: from.toISOString().slice(0, 10),
    Bitiş: to.toISOString().slice(0, 10),
    Organizasyon: ACTIVE_COMPETITIONS.length,
    "Azami API isteği": totalLimit,
    "Alınacak alanlar": "Korner, ofsayt, kart, şut, isabetli şut, faul, topa sahip olma",
  });

  if (process.env.CONFIRM_MATCH_STATS_IMPORT !== "YES") {
    console.log("\nGüvenli durdurma: henüz API isteği gönderilmedi.");
    console.log('PowerShell: $env:CONFIRM_MATCH_STATS_IMPORT = "YES"');
    console.log('PowerShell: $env:API_FOOTBALL_MIN_INTERVAL_MS = "1200"');
    console.log("Ardından: pnpm run statistics:import-v9");
    return;
  }

  let remainingBudget = totalLimit;
  let stopAll = false;
  const rows: Array<Record<string, string | number>> = [];

  for (const competition of ACTIVE_COMPETITIONS) {
    if (remainingBudget <= 0 || stopAll) break;

    try {
      const result = await importMatchTeamStatistics({
        leagueApiId: competition.apiId,
        seasonYear: ACTIVE_SEASON_YEAR,
        maximumMatches: remainingBudget,
        from,
        to,
        refreshIncomplete: false,
      });

      remainingBudget -= result.apiRequests;
      stopAll = result.stoppedByDailyLimit || result.stoppedByRateLimit;
      rows.push({
        Lig: competition.name,
        Aday: result.candidateMatches,
        İşlenen: result.matchesProcessed,
        Atlanan: result.matchesSkipped,
        "API veri yok": result.matchesUnavailable,
        "Takım kaydı": result.teamStatisticsSaved,
        "API isteği": result.apiRequests,
        Kalan: result.remainingMatches,
        Durum: stopAll ? "LİMİTTE DURDU" : "TAMAM",
      });
    } catch (error) {
      rows.push({
        Lig: competition.name,
        Aday: 0,
        İşlenen: 0,
        Atlanan: 0,
        "API veri yok": 0,
        "Takım kaydı": 0,
        "API isteği": 0,
        Kalan: 0,
        Durum: error instanceof Error ? `UYARI: ${error.message}` : "UYARI",
      });
    }
  }

  console.log("\n==============================================");
  console.log("ADVANCED STATISTICS SUMMARY");
  console.log("==============================================");
  console.table(rows);
  console.log(`Kullanılan azami bütçe: ${totalLimit - remainingBudget}/${totalLimit}`);
  console.log("Ana %20 ML / %80 Poisson ağırlıkları değiştirilmedi.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
