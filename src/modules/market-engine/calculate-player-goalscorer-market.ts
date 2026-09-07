import { prisma } from "@/lib/prisma";

import type {
  MarketSelection,
} from "./types";

function createSelection(
  key: string,
  market: string,
  selection: string,
  probability: number,
): MarketSelection {
  const clamped = Math.min(Math.max(probability, 0.0001), 0.9999);

  return {
    key,
    category: "PLAYER_GOALS",
    market,
    selection,
    probability: Math.round(clamped * 10000) / 100,
    fairOdds: Math.round((1 / clamped) * 100) / 100,
  };
}

async function anytimeScorersForTeam(
  teamId: number,
  seasonId: number,
  teamExpectedGoals: number,
): Promise<{ playerName: string; expectedGoals: number }[]> {
  const players = await prisma.playerSeasonStatistic.findMany({
    where: {
      teamId,
      seasonId,
      minutes: { gt: 0 },
    },
    select: {
      goals: true,
      expectedGoals: true,
      player: {
        select: { name: true },
      },
    },
  });

  if (players.length === 0) {
    return [];
  }

  // xG varsa (daha az gürültülü, gelecek performansı daha iyi
  // tahmin eder) onu, yoksa gerçekleşen gol sayısını kullanıyoruz.
  const weight = (row: (typeof players)[number]) =>
    row.expectedGoals ?? row.goals;

  const teamTotalWeight = players.reduce(
    (sum, row) => sum + weight(row),
    0,
  );

  if (teamTotalWeight <= 0) {
    return [];
  }

  return players
    .map((row) => ({
      playerName: row.player.name,
      expectedGoals:
        (weight(row) / teamTotalWeight) * teamExpectedGoals,
    }))
    .filter((row) => row.expectedGoals > 0);
}

/**
 * "Oyuncu Golü (kim gol atar)" market'ini üretir. Yeni bir API çağrısı
 * GEREKTİRMEZ: mevcut PlayerSeasonStatistic (gol/xG/dakika) verisini,
 * zaten hesaplanmış maç bazlı takım beklenen gol sayısına (goalModel)
 * orantılayarak dağıtır, ardından Poisson "en az 1 gol" olasılığını
 * hesaplar.
 *
 * Bir oyuncunun bu sezon hiç dakika almadığı veya takımın hiç kayıtlı
 * oyuncu istatistiği olmadığı durumlarda boş dizi döner — sahte veri
 * üretmez.
 */
export async function calculatePlayerGoalscorerMarket(
  homeTeamId: number,
  awayTeamId: number,
  seasonId: number,
  homeExpectedGoals: number,
  awayExpectedGoals: number,
  topN = 8,
): Promise<MarketSelection[]> {
  const [homeScorers, awayScorers] = await Promise.all([
    anytimeScorersForTeam(homeTeamId, seasonId, homeExpectedGoals),
    anytimeScorersForTeam(awayTeamId, seasonId, awayExpectedGoals),
  ]);

  const combined = [...homeScorers, ...awayScorers]
    .sort((left, right) => right.expectedGoals - left.expectedGoals)
    .slice(0, topN);

  return combined.map((row, index) =>
    createSelection(
      `player_goal_${index}_${row.playerName}`,
      "Oyuncu Golü (Kim Gol Atar)",
      row.playerName,
      1 - Math.exp(-row.expectedGoals),
    ),
  );
}
