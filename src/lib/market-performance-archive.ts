import type { ProductionDashboardPrediction } from "@/lib/prediction-dashboard";
import {
  buildBetMarketCatalog,
  settleBetMarketOption,
  type BetMarketSettlement,
  type BetMarketTier,
} from "@/lib/bet-market-catalog";

export type MarketPerformanceType = {
  number: number;
  title: string;
};

export type MarketPerformanceArchiveRow = {
  id: string;
  marketNumber: number;
  marketTitle: string;
  matchId: number;
  kickoffAt: Date;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  selection: string;
  optionKey: string;
  probability: number;
  fairOdds: number;
  score: number;
  tier: BetMarketTier;
  confidenceScore: number;
  dataQualityScore: number;
  selectionSide: "HOME" | "DRAW" | "AWAY" | "NEUTRAL";
  publicationBand: "STRONG" | "MEDIUM" | "REVIEW" | "NOT_RECOMMENDED";
  minimumFairOddsPassed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  result: BetMarketSettlement;
};

export const MINIMUM_ACCEPTABLE_FAIR_ODDS = 1.1;

function selectionSide(optionKey: string): MarketPerformanceArchiveRow["selectionSide"] {
  const normalized = optionKey.toLocaleLowerCase("tr-TR");
  if (
    normalized === "ms-1" || normalized === "dnb-home" ||
    normalized === "scores-home-only" || normalized === "home-win-nil" ||
    normalized.startsWith("ev-") || normalized.endsWith("-home") ||
    normalized === "first-home" || normalized === "last-home"
  ) return "HOME";
  if (normalized === "ms-0") return "DRAW";
  if (
    normalized === "ms-2" || normalized === "dnb-away" ||
    normalized === "scores-away-only" || normalized === "away-win-nil" ||
    normalized.startsWith("dep-") || normalized.endsWith("-away") ||
    normalized === "first-away" || normalized === "last-away"
  ) return "AWAY";
  return "NEUTRAL";
}

function publicationBand(
  probability: number,
): MarketPerformanceArchiveRow["publicationBand"] {
  if (probability >= 60) return "STRONG";
  if (probability >= 50) return "MEDIUM";
  if (probability >= 40) return "REVIEW";
  return "NOT_RECOMMENDED";
}

export const MARKET_PERFORMANCE_TYPES: MarketPerformanceType[] = [
  { number: 1, title: "Maç Sonucu" },
  { number: 2, title: "Çifte Şans" },
  { number: 3, title: "İlk Yarı Sonucu" },
  { number: 4, title: "İlk Yarı / Maç Sonucu" },
  { number: 5, title: "Toplam Gol Alt / Üst" },
  { number: 6, title: "İlk Yarı Toplam Gol" },
  { number: 7, title: "Takım Golü Alt / Üst" },
  { number: 8, title: "Karşılıklı Gol" },
  { number: 9, title: "Maç Sonucu ve Alt / Üst" },
  { number: 10, title: "Alt / Üst ve Karşılıklı Gol" },
  { number: 11, title: "Gol Aralığı" },
  { number: 12, title: "Kesin Skor" },
  { number: 13, title: "Handikaplı Maç Sonucu" },
  { number: 14, title: "Beraberlikte Bahis Yok" },
  { number: 15, title: "Hangi Takım Gol Atar?" },
  { number: 16, title: "Golü Hangi Takım Atar?" },
  { number: 17, title: "İlk Golün Zamanı" },
  { number: 18, title: "Hangi Yarıda Daha Çok Gol?" },
  { number: 19, title: "Her İki Yarıda Gol" },
  { number: 20, title: "Kazanırken Gol Yemez" },
  { number: 21, title: "Korner Bahisleri" },
  { number: 22, title: "Kart Bahisleri" },
  { number: 23, title: "Ofsayt Bahisleri" },
  { number: 24, title: "Şut Bahisleri" },
  { number: 25, title: "Oyuncu Gol Bahisleri" },
  { number: 26, title: "Diğer Oyuncu Bahisleri" },
  { number: 27, title: "Bahis Oluşturucu" },
];

export function buildMarketPerformanceArchive(
  predictions: readonly ProductionDashboardPrediction[],
  options: { from: Date; to: Date },
): MarketPerformanceArchiveRow[] {
  return predictions.flatMap((prediction) => {
    if (
      prediction.kickoffAt < options.from ||
      prediction.kickoffAt > options.to
    ) {
      return [];
    }

    const homeScore = prediction.finalHomeScore ?? null;
    const awayScore = prediction.finalAwayScore ?? null;
    const isVoid = prediction.settlementStatus === "VOID";

    if (!isVoid && (homeScore === null || awayScore === null)) {
      return [];
    }

    const groups = buildBetMarketCatalog({
      matchId: prediction.matchId,
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      homeProbability: prediction.homeProbability,
      drawProbability: prediction.drawProbability,
      awayProbability: prediction.awayProbability,
      expectedHomeGoals: prediction.expectedHomeGoals,
      expectedAwayGoals: prediction.expectedAwayGoals,
      confidenceScore: prediction.confidenceScore,
      dataQualityScore: prediction.dataQualityScore,
      knownMarkets: prediction.popularMarketsSummary,
      locale: "tr",
    });

    return groups.flatMap((group) => {
      const bestOption = group.options[0];

      if (!bestOption) return [];
      if (group.number === 1 && bestOption.probability < 30) return [];

      const result: BetMarketSettlement = isVoid
        ? "VOID"
        : settleBetMarketOption(bestOption.key, homeScore, awayScore);

      return [{
        id: `${prediction.matchId}-${group.number}-${bestOption.key}`,
        marketNumber: group.number,
        marketTitle: group.title,
        matchId: prediction.matchId,
        kickoffAt: prediction.kickoffAt,
        leagueName: prediction.leagueName,
        homeTeam: prediction.homeTeam,
        awayTeam: prediction.awayTeam,
        selection: bestOption.selection,
        optionKey: bestOption.key,
        probability: bestOption.probability,
        fairOdds: bestOption.fairOdds,
        score: bestOption.score,
        tier: bestOption.tier,
        confidenceScore: prediction.confidenceScore,
        dataQualityScore: prediction.dataQualityScore,
        selectionSide: selectionSide(bestOption.key),
        publicationBand: publicationBand(bestOption.probability),
        minimumFairOddsPassed:
          bestOption.fairOdds >= MINIMUM_ACCEPTABLE_FAIR_ODDS,
        homeScore,
        awayScore,
        result,
      }];
    });
  }).sort((first, second) =>
    second.kickoffAt.getTime() - first.kickoffAt.getTime(),
  );
}
