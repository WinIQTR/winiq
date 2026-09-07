import type {
  MarketCategory,
  MarketSelection,
} from "./types";

export type PopularMarketRow = {
  label: string;
  supported: boolean;
  market?: string;
  selection?: string;
  probability?: number;
  fairOdds?: number | null;
  unsupportedReason?: string;
  isEstimate?: boolean;
};

function bestOf(
  selections: MarketSelection[],
  predicate: (selection: MarketSelection) => boolean,
): MarketSelection | null {
  const matches = selections.filter(predicate);

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((best, current) =>
    current.probability > best.probability ? current : best,
  );
}

function toRow(
  label: string,
  selection: MarketSelection | null,
  unsupportedReason?: string,
  isEstimate?: boolean,
): PopularMarketRow {
  if (!selection) {
    return {
      label,
      supported: false,
      unsupportedReason:
        unsupportedReason ??
        "Bu market için gerekli veri/model henüz projeye eklenmedi.",
    };
  }

  return {
    label,
    supported: true,
    market: selection.market,
    selection: selection.selection,
    probability: selection.probability,
    fairOdds: selection.fairOdds,
    isEstimate,
  };
}

function byCategory(
  selections: MarketSelection[],
  category: MarketCategory,
): MarketSelection[] {
  return selections.filter(
    (selection) => selection.category === category,
  );
}

/**
 * Kullanıcının belirttiği 13 popüler bahis türü için, mevcut market
 * motorunun ürettiği TAM (filtrelenmemiş) seçim listesinden en olası
 * seçimi bulur. Motorun henüz desteklemediği market türleri (kart,
 * korner, oyuncu golü, ilk yarı, devre/maç) için sahte veri üretmez —
 * açıkça "desteklenmiyor" olarak işaretler.
 */
export function buildPopularMarketsSummary(
  selections: MarketSelection[],
): PopularMarketRow[] {
  const matchResult = byCategory(selections, "MATCH_RESULT");
  const doubleChance = byCategory(selections, "DOUBLE_CHANCE");
  const totalGoals = byCategory(selections, "TOTAL_GOALS");
  const btts = byCategory(selections, "BTTS");
  const asianHandicap = byCategory(selections, "ASIAN_HANDICAP");
  const teamGoals = byCategory(selections, "TEAM_GOALS");
  const correctScore = byCategory(selections, "CORRECT_SCORE");
  const cards = byCategory(selections, "CARDS");
  const corners = byCategory(selections, "CORNERS");
  const offsides = byCategory(selections, "OFFSIDES");
  const shots = byCategory(selections, "SHOTS");
  const halfTimeResult = byCategory(selections, "HALF_TIME_RESULT");
  const halfTimeFullTime = byCategory(selections, "HALF_TIME_FULL_TIME");
  const playerGoals = byCategory(selections, "PLAYER_GOALS");

  const total25 = totalGoals.filter((selection) =>
    selection.market.includes("2.5"),
  );

  return [
    toRow(
      "Maç Sonucu (1X2)",
      bestOf(matchResult, () => true),
    ),

    toRow(
      "Çifte Şans (1X, X2, 12)",
      bestOf(doubleChance, () => true),
    ),

    toRow(
      "2.5 Gol Alt/Üst",
      bestOf(total25, () => true),
    ),

    toRow(
      "Karşılıklı Gol (KG / BTTS)",
      bestOf(btts, () => true),
    ),

    toRow(
      "Asya Handikap",
      bestOf(asianHandicap, () => true),
    ),

    toRow(
      "Toplam Gol",
      bestOf(totalGoals, () => true),
    ),

    toRow(
      "İlk Yarı Sonucu",
      bestOf(halfTimeResult, () => true),
      "Hesaplanamadı.",
      true,
    ),

    toRow(
      "Takım Golü Alt/Üst",
      bestOf(teamGoals, () => true),
    ),

    toRow(
      "Kart Bahisleri",
      bestOf(cards, (selection) => selection.market.includes("4.5")) ??
        bestOf(cards, () => true),
      "Bu maç için yeterli geçmiş kart istatistiği bulunamadı (MatchTeamStatistic boş). Fixtures/statistics import'unun çalıştırıldığından emin olun.",
      true,
    ),

    toRow(
      "Korner Alt/Üst",
      bestOf(corners, (selection) => selection.market.includes("9.5")) ??
        bestOf(corners, () => true),
      "Bu maç için yeterli geçmiş korner istatistiği bulunamadı (MatchTeamStatistic boş). Fixtures/statistics import'unun çalıştırıldığından emin olun.",
      true,
    ),

    toRow(
      "Oyuncu Golü (kim gol atar)",
      bestOf(playerGoals, () => true),
      "Bu maç için oyuncu istatistiği bulunamadı (sezon boyunca dakika almış oyuncu kaydı yok).",
      true,
    ),

    toRow(
      "Devre/Maç",
      bestOf(halfTimeFullTime, () => true),
      "Hesaplanamadı.",
      true,
    ),

    toRow(
      "Doğru Skor",
      bestOf(correctScore, () => true),
    ),

    toRow(
      "Ofsayt Alt/Üst",
      bestOf(offsides, (selection) => selection.market.includes("3.5")) ??
        bestOf(offsides, () => true),
      "En az üç iç/dış saha maçında ofsayt istatistiği birikmesi gerekiyor.",
      true,
    ),

    toRow(
      "Şut Alt/Üst",
      bestOf(shots, (selection) => selection.market.includes("İsabetli") && selection.market.includes("8.5")) ??
        bestOf(shots, () => true),
      "En az üç iç/dış saha maçında şut istatistiği birikmesi gerekiyor.",
      true,
    ),
  ];
}
