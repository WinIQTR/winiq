import "dotenv/config";

import { ACTIVE_COMPETITIONS } from "@/config/competitions";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { prisma } from "@/lib/prisma";

function coverage(value: number, total: number): string {
  return total > 0 ? `${value}/${total} · %${((value / total) * 100).toFixed(1)}` : "0/0 · %0.0";
}

async function main(): Promise<void> {
  const report: Array<Record<string, string | number>> = [];

  for (const competition of ACTIVE_COMPETITIONS) {
    const season = await prisma.season.findFirst({
      where: { year: ACTIVE_SEASON_YEAR, league: { apiId: competition.apiId } },
      select: { id: true },
    });

    if (!season) {
      report.push({ Lig: competition.name, Biten: 0, Kontrol: 0 });
      continue;
    }

    const [finished, stats] = await Promise.all([
      prisma.match.count({ where: { seasonId: season.id, status: "FINISHED" } }),
      prisma.matchTeamStatistic.findMany({
        where: { match: { seasonId: season.id, status: "FINISHED" } },
        select: {
          matchId: true,
          shots: true,
          shotsOnTarget: true,
          corners: true,
          offsides: true,
          yellowCards: true,
          redCards: true,
          source: true,
        },
      }),
    ]);

    const byMatch = new Map<number, typeof stats>();
    for (const row of stats) {
      const list = byMatch.get(row.matchId) ?? [];
      list.push(row);
      byMatch.set(row.matchId, list);
    }
    const matchRows = [...byMatch.values()];
    const checked = matchRows.filter((items) => items.length >= 2).length;
    const metricCount = (
      field: "shots" | "shotsOnTarget" | "corners" | "offsides" | "yellowCards",
    ): number => matchRows.filter(
      (items) => items.length >= 2 && items.every((item) => item[field] !== null),
    ).length;
    const unavailable = matchRows.filter(
      (items) => items.length >= 2 && items.every((item) => item.source === "API_FOOTBALL_NO_DATA"),
    ).length;

    report.push({
      Lig: competition.name,
      Biten: finished,
      Kontrol: coverage(checked, finished),
      Korner: coverage(metricCount("corners"), finished),
      Ofsayt: coverage(metricCount("offsides"), finished),
      Kart: coverage(metricCount("yellowCards"), finished),
      Şut: coverage(metricCount("shots"), finished),
      "İsabetli şut": coverage(metricCount("shotsOnTarget"), finished),
      "API veri yok": unavailable,
    });
  }

  console.log("\n==============================================");
  console.log("ADVANCED MATCH STATISTICS COVERAGE");
  console.log("==============================================");
  console.table(report);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
