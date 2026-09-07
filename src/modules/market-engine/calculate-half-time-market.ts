import type {
  MarketSelection,
} from "./types";

// Futbolda gollerin ortalama olarak yaklaşık %45'i ilk yarıda,
// %55'i ikinci yarıda atılır (yaygın kabul gören istatistiksel
// gözlem). Gerçek ilk yarı skor geçmişi biriktikçe (bkz. Match
// tablosuna eklenen homeHalfTimeScore/awayHalfTimeScore) bu sabit,
// takım/lig bazlı gerçek oranlarla değiştirilebilir — şu an için
// maç sonu beklenen gol oranını ölçekleyen bir yaklaşıklama kullanılıyor.
const FIRST_HALF_GOAL_SHARE = 0.45;

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

function buildHalfMatrix(
  homeLambda: number,
  awayLambda: number,
  maxGoals = 5,
): { home: number; away: number; probability: number }[] {
  const matrix: { home: number; away: number; probability: number }[] = [];

  for (let home = 0; home <= maxGoals; home += 1) {
    for (let away = 0; away <= maxGoals; away += 1) {
      matrix.push({
        home,
        away,
        probability:
          poissonProbability(home, homeLambda) *
          poissonProbability(away, awayLambda),
      });
    }
  }

  return matrix;
}

function createSelection(
  key: string,
  category: "HALF_TIME_RESULT" | "HALF_TIME_FULL_TIME",
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
 * İlk yarı sonucu (1X2) ve Devre/Maç (İY/MS) marketlerini, zaten
 * hesaplanmış maç sonu beklenen gol oranlarının (lambda) bilinen
 * ilk-yarı-gol-payı oranıyla ölçeklenmesiyle üretir.
 *
 * NOT: Bu bir YAKLAŞIKLAMADIR, gerçek ilk yarı istatistik geçmişine
 * dayanmaz (henüz yeterli geçmiş veri birikmediği için). Bu yüzden
 * "10 Safest Markets" gibi üretim/öneri listelerine dahil edilmemesi,
 * yalnızca bilgilendirme amaçlı gösterilmesi önerilir.
 */
export function calculateHalfTimeMarkets(
  fullTimeHomeExpectedGoals: number,
  fullTimeAwayExpectedGoals: number,
): MarketSelection[] {
  const homeHalfLambda =
    fullTimeHomeExpectedGoals * FIRST_HALF_GOAL_SHARE;
  const awayHalfLambda =
    fullTimeAwayExpectedGoals * FIRST_HALF_GOAL_SHARE;

  const halfMatrix = buildHalfMatrix(homeHalfLambda, awayHalfLambda);

  let htHome = 0;
  let htDraw = 0;
  let htAway = 0;

  for (const cell of halfMatrix) {
    if (cell.home > cell.away) htHome += cell.probability;
    else if (cell.home < cell.away) htAway += cell.probability;
    else htDraw += cell.probability;
  }

  const selections: MarketSelection[] = [
    createSelection(
      "ht_result_home",
      "HALF_TIME_RESULT",
      "İlk Yarı Sonucu",
      "HOME",
      htHome,
    ),
    createSelection(
      "ht_result_draw",
      "HALF_TIME_RESULT",
      "İlk Yarı Sonucu",
      "DRAW",
      htDraw,
    ),
    createSelection(
      "ht_result_away",
      "HALF_TIME_RESULT",
      "İlk Yarı Sonucu",
      "AWAY",
      htAway,
    ),
  ];

  // Devre/Maç (HT/FT): ilk yarı sonucu ile ikinci yarı eğilimi
  // arasındaki 9 kombinasyon. Basitleştirme: ilk yarı ve ikinci
  // yarı sonuçlarının istatistiksel olarak bağımsız olduğu
  // varsayılıyor (yaygın bir yaklaşıklama, gerçekte hafif
  // korelasyon vardır — örn. önde olan takım oyun temposunu düşürebilir).
  const secondHalfHomeLambda =
    fullTimeHomeExpectedGoals * (1 - FIRST_HALF_GOAL_SHARE);
  const secondHalfAwayLambda =
    fullTimeAwayExpectedGoals * (1 - FIRST_HALF_GOAL_SHARE);

  const secondHalfMatrix = buildHalfMatrix(
    secondHalfHomeLambda,
    secondHalfAwayLambda,
  );

  let shHome = 0;
  let shDraw = 0;
  let shAway = 0;

  for (const cell of secondHalfMatrix) {
    if (cell.home > cell.away) shHome += cell.probability;
    else if (cell.home < cell.away) shAway += cell.probability;
    else shDraw += cell.probability;
  }

  const htOutcomes: [string, number][] = [
    ["HOME", htHome],
    ["DRAW", htDraw],
    ["AWAY", htAway],
  ];

  const secondHalfOutcomes: [string, number][] = [
    ["HOME", shHome],
    ["DRAW", shDraw],
    ["AWAY", shAway],
  ];

  for (const [htLabel, htProb] of htOutcomes) {
    for (const [ftLabel, shProb] of secondHalfOutcomes) {
      // Basitleştirilmiş bağımsızlık varsayımı: P(İY=x, MS eğilimi=y).
      selections.push(
        createSelection(
          `ht_ft_${htLabel}_${ftLabel}`,
          "HALF_TIME_FULL_TIME",
          "Devre/Maç",
          `${htLabel}/${ftLabel}`,
          htProb * shProb,
        ),
      );
    }
  }

  return selections;
}
