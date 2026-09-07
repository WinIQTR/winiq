import type {
  MarketEngineResult,
  MarketSelection,
} from "@/modules/market-engine";

import {
  MARKET_RELIABILITY_PROFILE,
} from "./reliability-profile";

import type {
  MarketReliabilityProfile,
  RankedMarketPick,
  ReliabilityTier,
  TopPicksOptions,
  TopPicksResult,
} from "./types";

const MODEL_NAME =
  "historical-reliability-top-picks";

const MODEL_VERSION =
  "v1.1-diversified";

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
        factor,
    ) /
    factor
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(
      value,
      minimum,
    ),
    maximum,
  );
}

/*
 * ============================================================
 * THRESHOLD RELIABILITY
 * ============================================================
 */

function getThresholdPerformance(
  profile:
    MarketReliabilityProfile,

  probability:
    number,
): {
  hitRate: number | null;
  samples: number;
} {
  /*
   * En yüksek güven grubunu kullanıyoruz.
   *
   * Ancak örneklem küçükse aşağıdaki daha
   * güvenilir sample grubuna düşüyoruz.
   */

  if (
    probability >= 90 &&
    profile.samples90 >= 100 &&
    profile.hit90 !== null
  ) {
    return {
      hitRate:
        profile.hit90,

      samples:
        profile.samples90,
    };
  }

  if (
    probability >= 80 &&
    profile.samples80 >= 100 &&
    profile.hit80 !== null
  ) {
    return {
      hitRate:
        profile.hit80,

      samples:
        profile.samples80,
    };
  }

  if (
    probability >= 70 &&
    profile.samples70 >= 100 &&
    profile.hit70 !== null
  ) {
    return {
      hitRate:
        profile.hit70,

      samples:
        profile.samples70,
    };
  }

  return {
    hitRate:
      profile.historicalHitRate,

    samples:
      profile.historicalSamples,
  };
}

/*
 * ============================================================
 * RELIABILITY COMPONENTS
 * ============================================================
 */

function calculateSampleScore(
  samples: number,
): number {
  /*
   * 1000 veya üzeri sample:
   * maksimum güven.
   */

  return clamp(
    samples /
      10,
    0,
    100,
  );
}

function calculateCalibrationScore(
  gap: number,
): number {
  /*
   * Calibration gap:
   *
   * 0 puan farkı   -> 100
   * 1 puan farkı   -> 90
   * 2 puan farkı   -> 80
   * 5 puan farkı   -> 50
   * 10+            -> 0
   */

  return clamp(
    100 -
      Math.abs(
        gap,
      ) *
        10,
    0,
    100,
  );
}

function calculateBrierQuality(
  brier: number,
): number {
  /*
   * Binary Brier.
   *
   * 0     = mükemmel
   * 0.30+ = çok zayıf
   */

  return clamp(
    (
      1 -
      brier /
        0.3
    ) *
      100,
    0,
    100,
  );
}

function calculateOddsUtility(
  fairOdds:
    number | null,
): number {
  if (
    fairOdds ===
    null
  ) {
    return 40;
  }

  /*
   * Bu VALUE BET değildir.
   *
   * Ama 1.02 - 1.05 gibi çok kolay
   * seçimlerin Top 10'u tamamen
   * doldurmasını engeller.
   */

  if (
    fairOdds <
    1.08
  ) {
    return 30;
  }

  if (
    fairOdds <
    1.15
  ) {
    return 50;
  }

  if (
    fairOdds <
    1.25
  ) {
    return 70;
  }

  if (
    fairOdds <=
    3
  ) {
    return 100;
  }

  if (
    fairOdds <=
    5
  ) {
    return 80;
  }

  return 55;
}

function calculateTier(
  reliabilityScore:
    number,
): ReliabilityTier {
  if (
    reliabilityScore >=
    85
  ) {
    return "VERY_HIGH";
  }

  if (
    reliabilityScore >=
    75
  ) {
    return "HIGH";
  }

  if (
    reliabilityScore >=
    60
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

/*
 * ============================================================
 * RANK SINGLE SELECTION
 * ============================================================
 */

function rankSelection(
  selection:
    MarketSelection,

  profile:
    MarketReliabilityProfile,
): Omit<
  RankedMarketPick,
  "rank"
> {
  const threshold =
    getThresholdPerformance(
      profile,
      selection.probability,
    );

  const historicalSignal =
    threshold.hitRate ??
    profile.historicalHitRate;

  const calibrationScore =
    calculateCalibrationScore(
      profile.calibrationGap,
    );

  const sampleScore =
    calculateSampleScore(
      threshold.samples,
    );

  const brierQuality =
    calculateBrierQuality(
      profile.brier,
    );

  /*
   * Historical Reliability
   *
   * %50 threshold hit rate
   * %20 calibration
   * %15 sample size
   * %15 Brier
   */

  const reliabilityScore =
    clamp(
      historicalSignal *
        0.5 +
      calibrationScore *
        0.2 +
      sampleScore *
        0.15 +
      brierQuality *
        0.15,
      0,
      100,
    );

  const oddsUtility =
    calculateOddsUtility(
      selection.fairOdds,
    );

  /*
   * Final Pick Score
   *
   * %40 mevcut probability
   * %45 historical reliability
   * %15 odds utility
   */

  const pickScore =
    clamp(
      selection.probability *
        0.4 +
      reliabilityScore *
        0.45 +
      oddsUtility *
        0.15,
      0,
      100,
    );

  const reasons:
    string[] = [];

  if (
    selection.probability >=
    80
  ) {
    reasons.push(
      "The model probability is very high.",
    );
  } else if (
    selection.probability >=
    70
  ) {
    reasons.push(
      "The model probability is high.",
    );
  }

  if (
    Math.abs(
      profile.calibrationGap,
    ) <= 1
  ) {
    reasons.push(
      "Historical prediction-to-outcome calibration is strong.",
    );
  }

  if (
    threshold.samples >=
    500
  ) {
    reasons.push(
      "Supported by a large historical sample.",
    );
  }

  if (
    threshold.hitRate !==
      null &&
    threshold.hitRate >=
      80
  ) {
    reasons.push(
      `Benzer güven seviyesinde tarihsel başarı %${round(
        threshold.hitRate,
      )}.`,
    );
  }

  if (
    selection.fairOdds !==
      null &&
    selection.fairOdds <
      1.15
  ) {
    reasons.push(
      "Probability is high, but fair odds are low.",
    );
  }

  return {
    key:
      selection.key,

    category:
      selection.category,

    market:
      selection.market,

    selection:
      selection.selection,

    probability:
      selection.probability,

    fairOdds:
      selection.fairOdds,

    historicalHitRate:
      profile.historicalHitRate,

    historicalSamples:
      profile.historicalSamples,

    thresholdHitRate:
      threshold.hitRate,

    thresholdSamples:
      threshold.samples,

    calibrationGap:
      profile.calibrationGap,

    brier:
      profile.brier,

    reliabilityScore:
      round(
        reliabilityScore,
      ),

    pickScore:
      round(
        pickScore,
      ),

    tier:
      calculateTier(
        reliabilityScore,
      ),

    reasons,
  };
}

/*
 * ============================================================
 * EXACT EVENT DEDUPLICATION
 * ============================================================
 *
 * Bazı marketler isim olarak farklı fakat
 * matematiksel olarak aynı olayı temsil eder.
 *
 * Ör:
 *
 * Away Team Over 0.5
 * =
 * Home Clean Sheet NO
 */

function getEquivalentEventKey(
  selection:
    MarketSelection,
): string {
  switch (
    selection.key
  ) {
    case "away_team_goals_over_0.5":
    case "home_clean_sheet_no":
      return "AWAY_SCORES_AT_LEAST_ONE";

    case "away_team_goals_under_0.5":
    case "home_clean_sheet_yes":
      return "AWAY_SCORES_ZERO";

    case "home_team_goals_over_0.5":
    case "away_clean_sheet_no":
      return "HOME_SCORES_AT_LEAST_ONE";

    case "home_team_goals_under_0.5":
    case "away_clean_sheet_yes":
      return "HOME_SCORES_ZERO";

    default:
      return selection.key;
  }
}

/*
 * ============================================================
 * MARKET FAMILY
 * ============================================================
 *
 * Bir market ailesinin Top 10'u tamamen
 * ele geçirmesini engelliyoruz.
 */

function getMarketFamily(
  selection:
    MarketSelection,
): string {
  const key =
    selection.key;

  if (
    key.startsWith(
      "match_result_",
    )
  ) {
    return "MATCH_RESULT";
  }

  if (
    key.startsWith(
      "double_chance_",
    )
  ) {
    return "DOUBLE_CHANCE";
  }

  if (
    key.startsWith(
      "dnb_",
    )
  ) {
    return "DRAW_NO_BET";
  }

  if (
    key.startsWith(
      "total_goals_",
    )
  ) {
    return "TOTAL_GOALS";
  }

  if (
    key.startsWith(
      "home_team_goals_",
    )
  ) {
    return "HOME_TEAM_GOALS";
  }

  if (
    key.startsWith(
      "away_team_goals_",
    )
  ) {
    return "AWAY_TEAM_GOALS";
  }

  if (
    key ===
      "btts_yes" ||
    key ===
      "btts_no"
  ) {
    return "BTTS";
  }

  if (
    key.startsWith(
      "home_clean_sheet_",
    )
  ) {
    return "HOME_CLEAN_SHEET";
  }

  if (
    key.startsWith(
      "away_clean_sheet_",
    )
  ) {
    return "AWAY_CLEAN_SHEET";
  }

  if (
    key.startsWith(
      "home_win_to_nil_",
    )
  ) {
    return "HOME_WIN_TO_NIL";
  }

  if (
    key.startsWith(
      "away_win_to_nil_",
    )
  ) {
    return "AWAY_WIN_TO_NIL";
  }

  return selection.category;
}

/*
 * Ör:
 *
 * Total Goals 2.5 OVER
 * Total Goals 2.5 UNDER
 *
 * aynı market.
 */

function getExactMarketKey(
  selection:
    MarketSelection,
): string {
  return selection.market;
}

/*
 * ============================================================
 * PUBLIC FUNCTION
 * ============================================================
 */

export function rankTopPicks(
  marketResult:
    MarketEngineResult,

  options?:
    TopPicksOptions,
): TopPicksResult {
  const limit =
    options?.limit ??
    10;

  const minimumProbability =
    options
      ?.minimumProbability ??
    60;

  const minimumHistoricalSamples =
    options
      ?.minimumHistoricalSamples ??
    300;

  const minimumFairOdds =
    options
      ?.minimumFairOdds ??
    1.05;

  const maximumFairOdds =
    options
      ?.maximumFairOdds ??
    5;

  const maximumSelectionsPerMarket =
    options
      ?.maximumSelectionsPerMarket ??
    1;

  const maximumSelectionsPerFamily =
    options
      ?.maximumSelectionsPerFamily ??
    2;

  const warnings:
    string[] = [];

  /*
   * ============================================================
   * FILTER + SCORE
   * ============================================================
   */

  const candidates =
    marketResult.selections
      .filter(
        (
          selection,
        ) => {
          const profile =
            MARKET_RELIABILITY_PROFILE[
              selection.key
            ];

          if (
            !profile
          ) {
            return false;
          }

          if (
            selection.probability <
            minimumProbability
          ) {
            return false;
          }

          if (
            profile.historicalSamples <
            minimumHistoricalSamples
          ) {
            return false;
          }

          if (
            selection.fairOdds !==
              null &&
            selection.fairOdds <
              minimumFairOdds
          ) {
            return false;
          }

          if (
            selection.fairOdds !==
              null &&
            selection.fairOdds >
              maximumFairOdds
          ) {
            return false;
          }

          return true;
        },
      )
      .map(
        (
          selection,
        ) => {
          const profile =
            MARKET_RELIABILITY_PROFILE[
              selection.key
            ];

          return {
            selection,

            ranked:
              rankSelection(
                selection,
                profile,
              ),
          };
        },
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.ranked.pickScore -
          left.ranked.pickScore,
      );

  /*
   * ============================================================
   * DIVERSIFICATION
   * ============================================================
   */

  const selected:
    Omit<
      RankedMarketPick,
      "rank"
    >[] = [];

  /*
   * Matematiksel olarak aynı olayın
   * iki kez gösterilmesini önler.
   */

  const usedEquivalentEvents =
    new Set<
      string
    >();

  /*
   * Aynı exact marketten örn.
   *
   * OVER ve UNDER
   *
   * birlikte gösterilmesini kontrol eder.
   */

  const exactMarketCounts =
    new Map<
      string,
      number
    >();

  /*
   * Aynı market ailesi Top Picks'i
   * domine etmesin.
   */

  const familyCounts =
    new Map<
      string,
      number
    >();

  for (
    const candidate
    of candidates
  ) {
    const equivalentEventKey =
      getEquivalentEventKey(
        candidate.selection,
      );

    if (
      usedEquivalentEvents.has(
        equivalentEventKey,
      )
    ) {
      continue;
    }

    const exactMarketKey =
      getExactMarketKey(
        candidate.selection,
      );

    const exactMarketCount =
      exactMarketCounts.get(
        exactMarketKey,
      ) ??
      0;

    if (
      exactMarketCount >=
      maximumSelectionsPerMarket
    ) {
      continue;
    }

    const family =
      getMarketFamily(
        candidate.selection,
      );

    const familyCount =
      familyCounts.get(
        family,
      ) ??
      0;

    if (
      familyCount >=
      maximumSelectionsPerFamily
    ) {
      continue;
    }

    selected.push(
      candidate.ranked,
    );

    usedEquivalentEvents.add(
      equivalentEventKey,
    );

    exactMarketCounts.set(
      exactMarketKey,
      exactMarketCount +
        1,
    );

    familyCounts.set(
      family,
      familyCount +
        1,
    );

    if (
      selected.length >=
      limit
    ) {
      break;
    }
  }

  /*
   * Eğer diversity filtreleri nedeniyle
   * 10 pick oluşmazsa hata değil.
   *
   * Kalitesiz tahmin eklemek yerine
   * daha az tahmin göstermek daha doğru.
   */

  if (
    selected.length <
    limit
  ) {
    warnings.push(
      [
        `Instead of the requested ${limit} picks,`,
        `${selected.length} distinct and sufficiently reliable picks were found.`,
        "No weaker selections were added just to fill the list.",
      ].join(" "),
    );
  }

  return {
    matchId:
      marketResult.matchId,

    picks:
      selected.map(
        (
          pick,
          index,
        ) => ({
          rank:
            index +
            1,

          ...pick,
        }),
      ),

    consideredSelections:
      marketResult
        .selections
        .length,

    eligibleSelections:
      candidates.length,

    model: {
      name:
        MODEL_NAME,

      version:
        MODEL_VERSION,
    },

    warnings: [
      ...marketResult.warnings,
      ...warnings,
    ],
  };
}
