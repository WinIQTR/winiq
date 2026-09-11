import { prisma } from "@/lib/prisma";

import type {
  MarketSelection,
} from "./types";

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) {
    result *= i;
  }
  return result;
}

function poissonProbability(count: number, lambda: number): number {
  return (
    (Math.exp(-lambda) * lambda ** count) / factorial(count)
  );
}

function overUnderProbability(
  line: number,
  lambda: number,
): { over: number; under: number } {
  // Yarım çizgiler (3.5, 8.5 vb.) kullanıldığı için push senaryosu yok.
  const threshold = Math.floor(line);

  let underCumulative = 0;
  for (let count = 0; count <= threshold; count += 1) {
    underCumulative += poissonProbability(count, lambda);
  }

  return {
    under: underCumulative,
    over: 1 - underCumulative,
  };
}

async function averagePerTeamVenue(
  teamId: number,
  seasonId: number,
  venue: "HOME" | "AWAY",
  field:
    | "corners"
    | "yellowCards"
    | "redCards"
    | "offsides"
    | "shots"
    | "shotsOnTarget",
): Promise<number | null> {
  const matches = await prisma.match.findMany({
    where: {
      seasonId,
      status: "FINISHED",
      ...(venue === "HOME"
        ? { homeTeamId: teamId }
        : { awayTeamId: teamId }),
    },
    select: { id: true },
  });

  if (matches.length === 0) {
    return null;
  }

  const stats = await prisma.matchTeamStatistic.findMany({
    where: {
      teamId,
      matchId: { in: matches.map((match) => match.id) },
      [field]: { not: null },
    },
    select: { [field]: true },
  });

  if (stats.length < 3) {
    const seasonStats = await prisma.matchTeamStatistic.findMany({
      where: {
        teamId,
        match: { seasonId, status: "FINISHED" },
        [field]: { not: null },
      },
      select: { [field]: true },
      orderBy: { match: { kickoffAt: "desc" } },
      take: 8,
    });

    if (seasonStats.length < 3) {
      return null;
    }

    const seasonTotal = seasonStats.reduce(
      (sum, row) => sum + (row[field as keyof typeof row] as number),
      0,
    );

    return seasonTotal / seasonStats.length;
  }

  const total = stats.reduce(
    (sum, row) => sum + (row[field as keyof typeof row] as number),
    0,
  );

  return total / stats.length;
}

const CARD_LINES = [2.5, 3.5, 4.5, 5.5];
const CORNER_LINES = [7.5, 8.5, 9.5, 10.5, 11.5];
const OFFSIDE_LINES = [2.5, 3.5, 4.5, 5.5];
const SHOTS_ON_TARGET_LINES = [6.5, 7.5, 8.5, 9.5, 10.5];
const TOTAL_SHOTS_LINES = [19.5, 22.5, 25.5, 28.5];

function createSelection(
  key: string,
  category: "CARDS" | "CORNERS" | "OFFSIDES" | "SHOTS",
  market: string,
  selection: string,
  probability: number,
): MarketSelection {
  const clamped = Math.min(Math.max(probability, 0.0001), 0.9999);

  return {
    key,
    category,
    market,
    selection,
    probability: Math.round(clamped * 10000) / 100,
    fairOdds: Math.round((1 / clamped) * 100) / 100,
  };
}

/**
 * Kart ve korner Alt/Üst marketlerini, o sezon içinde her iki takımın
 * (ev sahibi kendi ev maçlarında, deplasman kendi deplasman maçlarında)
 * ortalama kart/korner sayısından Poisson dağılımıyla hesaplar.
 *
 * Yeni bir API çağrısı GEREKTİRMEZ — MatchTeamStatistic tablosu zaten
 * `admin/import/fixtures` sonrası `fixtures/statistics` importer'ı ile
 * doluysa bu fonksiyon çalışır. Yeterli geçmiş veri yoksa (takım bu
 * sezon hiç istatistik verisi almamışsa) boş dizi döner — sahte veri
 * üretmez.
 */
export async function calculateCardsCornersMarkets(
  homeTeamId: number,
  awayTeamId: number,
  seasonId: number,
): Promise<MarketSelection[]> {
  const [
    homeCorners,
    awayCorners,
    homeYellow,
    awayYellow,
    homeRed,
    awayRed,
    homeOffsides,
    awayOffsides,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
  ] = await Promise.all([
    averagePerTeamVenue(homeTeamId, seasonId, "HOME", "corners"),
    averagePerTeamVenue(awayTeamId, seasonId, "AWAY", "corners"),
    averagePerTeamVenue(homeTeamId, seasonId, "HOME", "yellowCards"),
    averagePerTeamVenue(awayTeamId, seasonId, "AWAY", "yellowCards"),
    averagePerTeamVenue(homeTeamId, seasonId, "HOME", "redCards"),
    averagePerTeamVenue(awayTeamId, seasonId, "AWAY", "redCards"),
    averagePerTeamVenue(homeTeamId, seasonId, "HOME", "offsides"),
    averagePerTeamVenue(awayTeamId, seasonId, "AWAY", "offsides"),
    averagePerTeamVenue(homeTeamId, seasonId, "HOME", "shots"),
    averagePerTeamVenue(awayTeamId, seasonId, "AWAY", "shots"),
    averagePerTeamVenue(homeTeamId, seasonId, "HOME", "shotsOnTarget"),
    averagePerTeamVenue(awayTeamId, seasonId, "AWAY", "shotsOnTarget"),
  ]);

  const selections: MarketSelection[] = [];

  if (homeCorners !== null && awayCorners !== null) {
    const lambda = homeCorners + awayCorners;

    // Kullanıcı dostu toplam korner aralıkları.
    const ranges: Array<[string, number, number | null]> = [["0-8", 0, 8], ["9-11", 9, 11], ["+12", 12, null]];
    for (const [label, min, max] of ranges) {
      let probability = 0;
      for (let count = 0; count <= 30; count += 1) {
        if (count >= min && (max === null || count <= max)) probability += poissonProbability(count, lambda);
      }
      selections.push(createSelection(`corners_range_${label.replace("+", "plus").replace("-", "_")}`, "CORNERS", "Toplam Korner Aralığı", label, probability));
    }

    for (const line of CORNER_LINES) {
      const { over, under } = overUnderProbability(line, lambda);

      selections.push(
        createSelection(
          `corners_over_${line}`,
          "CORNERS",
          `Toplam Korner ${line}`,
          "OVER",
          over,
        ),
      );

      selections.push(
        createSelection(
          `corners_under_${line}`,
          "CORNERS",
          `Toplam Korner ${line}`,
          "UNDER",
          under,
        ),
      );
    }
  }

  if (homeYellow !== null && awayYellow !== null) {
    // Kırmızı kart nadiren gerçekleşir; toplam kart beklentisine
    // (varsa) ortalama kırmızı kart oranını da ekliyoruz.
    const redComponent = (homeRed ?? 0) + (awayRed ?? 0);
    const lambda = homeYellow + awayYellow + redComponent;

    for (const line of CARD_LINES) {
      const { over, under } = overUnderProbability(line, lambda);

      selections.push(
        createSelection(
          `cards_over_${line}`,
          "CARDS",
          `Toplam Kart ${line}`,
          "OVER",
          over,
        ),
      );

      selections.push(
        createSelection(
          `cards_under_${line}`,
          "CARDS",
          `Toplam Kart ${line}`,
          "UNDER",
          under,
        ),
      );
    }
  }

  if (homeOffsides !== null && awayOffsides !== null) {
    const lambda = homeOffsides + awayOffsides;
    for (const line of OFFSIDE_LINES) {
      const { over, under } = overUnderProbability(line, lambda);
      selections.push(
        createSelection(`offsides_over_${line}`, "OFFSIDES", `Toplam Ofsayt ${line}`, "OVER", over),
        createSelection(`offsides_under_${line}`, "OFFSIDES", `Toplam Ofsayt ${line}`, "UNDER", under),
      );
    }
  }

  if (homeShotsOnTarget !== null && awayShotsOnTarget !== null) {
    const lambda = homeShotsOnTarget + awayShotsOnTarget;
    for (const line of SHOTS_ON_TARGET_LINES) {
      const { over, under } = overUnderProbability(line, lambda);
      selections.push(
        createSelection(`shots_on_target_over_${line}`, "SHOTS", `Toplam İsabetli Şut ${line}`, "OVER", over),
        createSelection(`shots_on_target_under_${line}`, "SHOTS", `Toplam İsabetli Şut ${line}`, "UNDER", under),
      );
    }
  }

  if (homeShots !== null && awayShots !== null) {
    const lambda = homeShots + awayShots;
    for (const line of TOTAL_SHOTS_LINES) {
      const { over, under } = overUnderProbability(line, lambda);
      selections.push(
        createSelection(`shots_over_${line}`, "SHOTS", `Toplam Şut ${line}`, "OVER", over),
        createSelection(`shots_under_${line}`, "SHOTS", `Toplam Şut ${line}`, "UNDER", under),
      );
    }
  }

  return selections;
}
