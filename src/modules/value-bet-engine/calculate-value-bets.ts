import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import {
  calculateMarketsFromGoalModel,
} from "@/modules/market-engine";

import type {
  MarketEngineResult,
  MarketSelection,
} from "@/modules/market-engine";

import {
  generateMatchPrediction,
} from "@/modules/prediction-engine";

import type {
  OutcomeProbabilities,
} from "@/modules/probability-engine";

import type {
  MarketOddsQuote,
  ValueBetComparison,
  ValueBetEngineOptions,
  ValueBetEngineResult,
  ValueBetLevel,
  ValueBetPublishStatus,
} from "./types";

import {
  evaluateOddsFreshness,
} from "./odds-freshness";

const DEFAULT_OPTIONS:
  Required<ValueBetEngineOptions> = {
  minimumBookmakerCount:
    3,

  minimumModelProbability:
    45,

  minimumOdds:
    1.25,

  maximumOdds:
    5,

  minimumMarketEdge:
    2,

  minimumExpectedValue:
    3,

  maximumRecommendedStakePercentage:
    2,

  maximumCaptureAgeMinutes:
  390,

  maximumPublishableEdge:
    15,

  maximumPublishableExpectedValue:
    30,

  maximumCriticalWarningCount:
    2,

  outlierTolerancePercentage:
    20,
};

const CRITICAL_WARNING_PATTERNS = [
  "olasılık sonucu üretilemedi",
  "aktif model bulunamadı",
  "kullanılabilir aktif feature bulunamadı",
  "nihai olasılıklar geçerli değil",
] as const;

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

function average(
  values:
    readonly number[],
): number {
  if (
    values.length ===
    0
  ) {
    return 0;
  }

  return (
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,
      0,
    ) /
    values.length
  );
}

function median(
  values:
    readonly number[],
): number {
  if (
    values.length ===
    0
  ) {
    return 0;
  }

  const sortedValues =
    [...values].sort(
      (
        first,
        second,
      ) =>
        first -
        second,
    );

  const middleIndex =
    Math.floor(
      sortedValues.length /
        2,
    );

  if (
    sortedValues.length %
      2 ===
    0
  ) {
    return (
      (
        sortedValues[
          middleIndex -
            1
        ] +
        sortedValues[
          middleIndex
        ]
      ) /
      2
    );
  }

  return sortedValues[
    middleIndex
  ];
}

function calculateFairOdds(
  probability: number,
): number | null {
  if (
    !Number.isFinite(
      probability,
    ) ||
    probability <=
      0
  ) {
    return null;
  }

  return round(
    100 /
      probability,
    2,
  );
}

function calculateExpectedValue(
  modelProbability:
    number,

  decimalOdds:
    number,
): number {
  const probability =
    modelProbability /
    100;

  return round(
    (
      probability *
        decimalOdds -
      1
    ) *
      100,
    2,
  );
}

function calculateKellyPercentage(
  modelProbability:
    number,

  decimalOdds:
    number,
): number {
  if (
    decimalOdds <=
    1
  ) {
    return 0;
  }

  const probability =
    modelProbability /
    100;

  const lossProbability =
    1 -
    probability;

  const netOdds =
    decimalOdds -
    1;

  const kelly =
    (
      netOdds *
        probability -
      lossProbability
    ) /
    netOdds;

  return round(
    Math.max(
      kelly,
      0,
    ) *
      100,
    2,
  );
}

function resolveValueLevel(
  expectedValue: number,
  marketEdge: number,
): ValueBetLevel {
  if (
    expectedValue >=
      12 &&
    marketEdge >=
      6
  ) {
    return "STRONG";
  }

  if (
    expectedValue >=
      6 &&
    marketEdge >=
      3
  ) {
    return "GOOD";
  }

  if (
    expectedValue >
      0 &&
    marketEdge >
      0
  ) {
    return "WATCH";
  }

  return "NONE";
}

function calculateValueScore(
  options: {
    modelProbability:
      number;

    marketEdge:
      number;

    expectedValue:
      number;

    bookmakerCount:
      number;

    predictionConfidence:
      number;
  },
): number {
  const probabilityScore =
    clamp(
      options.modelProbability,
      0,
      100,
    );

  const edgeScore =
    clamp(
      options.marketEdge *
        8,
      0,
      100,
    );

  const expectedValueScore =
    clamp(
      options.expectedValue *
        5,
      0,
      100,
    );

  const bookmakerScore =
    clamp(
      options.bookmakerCount *
        10,
      0,
      100,
    );

  return round(
    probabilityScore *
      0.2 +
    edgeScore *
      0.25 +
    expectedValueScore *
      0.3 +
    bookmakerScore *
      0.1 +
    options.predictionConfidence *
      0.15,
    2,
  );
}

function isCriticalWarning(
  warning: string,
): boolean {
  const normalizedWarning =
    warning
      .trim()
      .toLocaleLowerCase(
        "tr-TR",
      );

  return CRITICAL_WARNING_PATTERNS.some(
    (
      pattern,
    ) =>
      normalizedWarning.includes(
        pattern.toLocaleLowerCase(
          "tr-TR",
        ),
      ),
  );
}

function filterOutlierQuotes(
  quotes:
    readonly MarketOddsQuote[],

  tolerancePercentage:
    number,
): MarketOddsQuote[] {
  if (
    quotes.length <
    3
  ) {
    return [
      ...quotes,
    ];
  }

  const medianOdds =
    median(
      quotes.map(
        (
          quote,
        ) =>
          quote.decimalOdds,
      ),
    );

  if (
    medianOdds <=
    0
  ) {
    return [
      ...quotes,
    ];
  }

  const maximumDifference =
    medianOdds *
    (
      tolerancePercentage /
      100
    );

  return quotes.filter(
    (
      quote,
    ) =>
      Math.abs(
        quote.decimalOdds -
        medianOdds,
      ) <=
      maximumDifference,
  );
}

function resolvePublishStatus(
  options: {
    isValueBet:
      boolean;

    criticalWarningCount:
      number;

    validBookmakerCount:
      number;

    sourceOddsAgeMinutes:
  number;

captureAgeMinutes:
  number;

allowedSourceOddsAgeMinutes:
  number;

sourceIsFresh:
  boolean;

captureIsFresh:
  boolean;

    marketEdge:
      number;

    expectedValue:
      number;

    engineOptions:
      Required<ValueBetEngineOptions>;
  },
): {
  publishStatus:
    ValueBetPublishStatus;

  publishReasons:
    string[];
} {
  const reasons:
    string[] = [];

  if (
    !options.isValueBet
  ) {
    reasons.push(
      "Temel Value Bet filtreleri geçilemedi.",
    );

    return {
      publishStatus:
        "BLOCKED",

      publishReasons:
        reasons,
    };
  }

  if (
    options.criticalWarningCount >
    options
      .engineOptions
      .maximumCriticalWarningCount
  ) {
    reasons.push(
      [
        "Kritik veri uyarısı sınırı aşıldı.",
        `${options.criticalWarningCount}/${options.engineOptions.maximumCriticalWarningCount}.`,
      ].join(
        " ",
      ),
    );
  }

  if (
    options.validBookmakerCount <
    options
      .engineOptions
      .minimumBookmakerCount
  ) {
    reasons.push(
      [
        "Geçerli bookmaker sayısı yetersiz.",
        `${options.validBookmakerCount}/${options.engineOptions.minimumBookmakerCount}.`,
      ].join(
        " ",
      ),
    );
  }

 if (
  !options.captureIsFresh
) {
  reasons.push(
    [
      "Odds verisi yakın zamanda API'den kontrol edilmedi.",
      `${options.captureAgeMinutes.toFixed(
        0,
      )} dakika.`,
    ].join(
      " ",
    ),
  );
}

if (
  !options.sourceIsFresh
) {
  reasons.push(
    [
      "Bookmaker oran değişim zamanı maça kalan süreye göre eski.",
      `${options.sourceOddsAgeMinutes.toFixed(
        0,
      )}/${options.allowedSourceOddsAgeMinutes.toFixed(
        0,
      )} dakika.`,
    ].join(
      " ",
    ),
  );
}

  if (
    reasons.length >
    0
  ) {
    return {
      publishStatus:
        "BLOCKED",

      publishReasons:
        reasons,
    };
  }

  if (
    options.marketEdge >
    options
      .engineOptions
      .maximumPublishableEdge
  ) {
    reasons.push(
      [
        "Edge olağan yayın sınırının üzerinde.",
        `+%${options.marketEdge.toFixed(
          2,
        )}.`,
      ].join(
        " ",
      ),
    );
  }

  if (
    options.expectedValue >
    options
      .engineOptions
      .maximumPublishableExpectedValue
  ) {
    reasons.push(
      [
        "Expected Value olağan yayın sınırının üzerinde.",
        `+%${options.expectedValue.toFixed(
          2,
        )}.`,
      ].join(
        " ",
      ),
    );
  }

  if (
    reasons.length >
    0
  ) {
    return {
      publishStatus:
        "REVIEW",

      publishReasons:
        reasons,
    };
  }

  return {
    publishStatus:
      "PUBLISHABLE",

    publishReasons: [
      "Value, veri kalitesi ve odds güncellik kontrollerini geçti.",
    ],
  };
}

function applyFinalProbabilities(
  marketModel:
    MarketEngineResult,

  probabilities:
    OutcomeProbabilities,
): MarketEngineResult {
  const home =
    probabilities.home;

  const draw =
    probabilities.draw;

  const away =
    probabilities.away;

  const decisive =
    home +
    away;

  const dnbHome =
    decisive >
    0
      ? (
          home /
          decisive
        ) *
        100
      : 50;

  const dnbAway =
    decisive >
    0
      ? (
          away /
          decisive
        ) *
        100
      : 50;

  const overrides =
    new Map<
      string,
      number
    >([
      [
        "match_result_home",
        home,
      ],

      [
        "match_result_draw",
        draw,
      ],

      [
        "match_result_away",
        away,
      ],

      [
        "double_chance_1x",
        home +
          draw,
      ],

      [
        "double_chance_x2",
        draw +
          away,
      ],

      [
        "double_chance_12",
        home +
          away,
      ],

      [
        "dnb_home",
        dnbHome,
      ],

      [
        "dnb_away",
        dnbAway,
      ],
    ]);

  const selections =
    marketModel.selections.map(
      (
        selection,
      ) => {
        const probability =
          overrides.get(
            selection.key,
          );

        if (
          probability ===
          undefined
        ) {
          return selection;
        }

        return {
          ...selection,

          probability:
            round(
              probability,
              2,
            ),

          fairOdds:
            calculateFairOdds(
              probability,
            ),
        };
      },
    );

  return {
    ...marketModel,

    selections,

    topSelections:
      [
        ...selections,
      ]
        .sort(
          (
            first,
            second,
          ) =>
            second.probability -
            first.probability,
        )
        .slice(
          0,
          15,
        ),
  };
}

function resolveModelMarketKey(
  marketFamily:
    string,

  selectionName:
    string,
): string | null {
  if (
    marketFamily ===
    "MATCH_RESULT"
  ) {
    if (
      selectionName ===
      "HOME"
    ) {
      return "match_result_home";
    }

    if (
      selectionName ===
      "DRAW"
    ) {
      return "match_result_draw";
    }

    if (
      selectionName ===
      "AWAY"
    ) {
      return "match_result_away";
    }
  }

  if (
    marketFamily ===
    "DOUBLE_CHANCE"
  ) {
    if (
      selectionName ===
      "1X"
    ) {
      return "double_chance_1x";
    }

    if (
      selectionName ===
      "X2"
    ) {
      return "double_chance_x2";
    }

    if (
      selectionName ===
      "12"
    ) {
      return "double_chance_12";
    }
  }

  if (
    marketFamily ===
    "TOTAL_GOALS"
  ) {
    if (
      selectionName ===
      "OVER_2.5"
    ) {
      return "total_goals_over_2.5";
    }

    if (
      selectionName ===
      "UNDER_2.5"
    ) {
      return "total_goals_under_2.5";
    }
  }

  if (
    marketFamily ===
    "BTTS"
  ) {
    if (
      selectionName ===
      "YES"
    ) {
      return "btts_yes";
    }

    if (
      selectionName ===
      "NO"
    ) {
      return "btts_no";
    }
  }

  if (
    marketFamily ===
    "DRAW_NO_BET"
  ) {
    if (
      selectionName ===
      "HOME"
    ) {
      return "dnb_home";
    }

    if (
      selectionName ===
      "AWAY"
    ) {
      return "dnb_away";
    }
  }

  if (
    marketFamily ===
    "HOME_TEAM_GOALS"
  ) {
    if (
      selectionName ===
      "OVER_0.5"
    ) {
      return "home_team_goals_over_0.5";
    }

    if (
      selectionName ===
      "UNDER_0.5"
    ) {
      return "home_team_goals_under_0.5";
    }

    if (
      selectionName ===
      "OVER_1.5"
    ) {
      return "home_team_goals_over_1.5";
    }

    if (
      selectionName ===
      "UNDER_1.5"
    ) {
      return "home_team_goals_under_1.5";
    }
  }

  if (
    marketFamily ===
    "AWAY_TEAM_GOALS"
  ) {
    if (
      selectionName ===
      "OVER_0.5"
    ) {
      return "away_team_goals_over_0.5";
    }

    if (
      selectionName ===
      "UNDER_0.5"
    ) {
      return "away_team_goals_under_0.5";
    }

    if (
      selectionName ===
      "OVER_1.5"
    ) {
      return "away_team_goals_over_1.5";
    }

    if (
      selectionName ===
      "UNDER_1.5"
    ) {
      return "away_team_goals_under_1.5";
    }
  }

  return null;
}

function resolveOptions(
  options?:
    ValueBetEngineOptions,
): Required<ValueBetEngineOptions> {
  return {
    minimumBookmakerCount:
      options
        ?.minimumBookmakerCount ??
      DEFAULT_OPTIONS
        .minimumBookmakerCount,

    minimumModelProbability:
      options
        ?.minimumModelProbability ??
      DEFAULT_OPTIONS
        .minimumModelProbability,

    minimumOdds:
      options
        ?.minimumOdds ??
      DEFAULT_OPTIONS
        .minimumOdds,

    maximumOdds:
      options
        ?.maximumOdds ??
      DEFAULT_OPTIONS
        .maximumOdds,

    minimumMarketEdge:
      options
        ?.minimumMarketEdge ??
      DEFAULT_OPTIONS
        .minimumMarketEdge,

    minimumExpectedValue:
      options
        ?.minimumExpectedValue ??
      DEFAULT_OPTIONS
        .minimumExpectedValue,

    maximumRecommendedStakePercentage:
      options
        ?.maximumRecommendedStakePercentage ??
      DEFAULT_OPTIONS
        .maximumRecommendedStakePercentage,

    maximumCaptureAgeMinutes:
  options
    ?.maximumCaptureAgeMinutes ??
  DEFAULT_OPTIONS
    .maximumCaptureAgeMinutes,

    maximumPublishableEdge:
      options
        ?.maximumPublishableEdge ??
      DEFAULT_OPTIONS
        .maximumPublishableEdge,

    maximumPublishableExpectedValue:
      options
        ?.maximumPublishableExpectedValue ??
      DEFAULT_OPTIONS
        .maximumPublishableExpectedValue,

    maximumCriticalWarningCount:
      options
        ?.maximumCriticalWarningCount ??
      DEFAULT_OPTIONS
        .maximumCriticalWarningCount,

    outlierTolerancePercentage:
      options
        ?.outlierTolerancePercentage ??
      DEFAULT_OPTIONS
        .outlierTolerancePercentage,
  };
}

export async function calculateValueBets(
  matchId: number,
  inputOptions?:
    ValueBetEngineOptions,
): Promise<ValueBetEngineResult> {
  if (
    !Number.isInteger(
      matchId,
    ) ||
    matchId <=
      0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  const options =
    resolveOptions(
      inputOptions,
    );

  const now =
    new Date();

  const match =
    await prisma.match.findUnique({
      where: {
        id:
          matchId,
      },

      select: {
        id:
          true,

        apiId:
          true,

        kickoffAt:
          true,

        homeTeam: {
          select: {
            name:
              true,
          },
        },

        awayTeam: {
          select: {
            name:
              true,
          },
        },

        season: {
          select: {
            league: {
              select: {
                name:
                  true,
              },
            },
          },
        },
      },
    });

  if (
    !match
  ) {
    throw new Error(
      `Maç bulunamadı: ${matchId}`,
    );
  }

  if (
    match.kickoffAt <=
    now
  ) {
    throw new Error(
      [
        "Value Bet yalnızca başlamamış maçlar için hesaplanabilir.",
        `Başlama: ${match.kickoffAt.toISOString()}.`,
        `Şimdi: ${now.toISOString()}.`,
      ].join(
        " ",
      ),
    );
  }

  const prediction =
    await generateMatchPrediction({
      matchId,
    });

  const goalModel =
    await calculateGoalProbabilities(
      matchId,
    );

  const originalMarketModel =
    calculateMarketsFromGoalModel(
      goalModel,
    );

  const marketModel =
    applyFinalProbabilities(
      originalMarketModel,
      prediction.finalProbabilities,
    );

  const modelSelectionMap =
    new Map<
      string,
      MarketSelection
    >(
      marketModel.selections.map(
        (
          selection,
        ) => [
          selection.key,
          selection,
        ],
      ),
    );

  const warnings = [
    ...new Set([
      ...prediction.warnings,
      ...goalModel.warnings,
    ]),
  ];

  const criticalWarnings =
    warnings.filter(
      isCriticalWarning,
    );

  const snapshots =
    await prisma.oddsSnapshot.findMany({
      where: {
        matchId,
      },

      orderBy: [
        {
          bookmakerId:
            "asc",
        },

        {
          sourceUpdatedAt:
            "desc",
        },
      ],

      select: {
  bookmakerId:
    true,

  sourceUpdatedAt:
    true,

  capturedAt:
    true,

        bookmaker: {
          select: {
            name:
              true,

            isActive:
              true,
          },
        },

        markets: {
          select: {
            marketFamily:
              true,

            selections: {
              select: {
                selectionName:
                  true,

                decimalOdds:
                  true,

                impliedProbability:
                  true,

                normalizedProbability:
                  true,
              },
            },
          },
        },
      },
    });

  const latestSnapshots =
    snapshots.filter(
      (
        snapshot,
        index,
        allSnapshots,
      ) =>
        allSnapshots.findIndex(
          (
            candidate,
          ) =>
            candidate.bookmakerId ===
            snapshot.bookmakerId,
        ) ===
          index &&
        snapshot.bookmaker
          .isActive,
    );

  const quoteMap =
    new Map<
      string,
      MarketOddsQuote[]
    >();

  for (
    const snapshot
    of latestSnapshots
  ) {
    for (
      const market
      of snapshot.markets
    ) {
      for (
        const selection
        of market.selections
      ) {
        const modelMarketKey =
          resolveModelMarketKey(
            market.marketFamily,
            selection.selectionName,
          );

        if (
          !modelMarketKey
        ) {
          continue;
        }

        const quotes =
          quoteMap.get(
            modelMarketKey,
          ) ??
          [];

        quotes.push({
          bookmakerId:
            snapshot.bookmakerId,

          bookmakerName:
            snapshot.bookmaker.name,

          decimalOdds:
            selection.decimalOdds,

          impliedProbability:
            selection.impliedProbability,

          normalizedProbability:
            selection.normalizedProbability,

          sourceUpdatedAt:
            snapshot.sourceUpdatedAt,

capturedAt:
  snapshot.capturedAt,

        });

        quoteMap.set(
          modelMarketKey,
          quotes,
        );
      }
    }
  }

  const comparisons:
    ValueBetComparison[] =
      [];

  for (
    const [
      marketKey,
      quotes,
    ]
    of quoteMap
  ) {
    const modelSelection =
      modelSelectionMap.get(
        marketKey,
      );

    if (
      !modelSelection ||
      quotes.length ===
        0
    ) {
      continue;
    }

    const validQuotes =
      filterOutlierQuotes(
        quotes,
        options
          .outlierTolerancePercentage,
      );

    if (
      validQuotes.length ===
      0
    ) {
      continue;
    }

    const sortedQuotes =
      [...quotes].sort(
        (
          first,
          second,
        ) =>
          second.decimalOdds -
          first.decimalOdds,
      );

    const sortedValidQuotes =
      [...validQuotes].sort(
        (
          first,
          second,
        ) =>
          second.decimalOdds -
          first.decimalOdds,
      );

    const bestQuote =
      sortedValidQuotes[0];

    if (
      !bestQuote
    ) {
      continue;
    }

    const normalizedProbabilities =
      validQuotes
        .map(
          (
            quote,
          ) =>
            quote.normalizedProbability,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !==
            null,
        );

    if (
      normalizedProbabilities.length ===
      0
    ) {
      continue;
    }

    const averageOdds =
      round(
        average(
          validQuotes.map(
            (
              quote,
            ) =>
              quote.decimalOdds,
          ),
        ),
        2,
      );

    const medianOdds =
      round(
        median(
          validQuotes.map(
            (
              quote,
            ) =>
              quote.decimalOdds,
          ),
        ),
        2,
      );

    const averageMarketProbability =
      round(
        average(
          normalizedProbabilities,
        ),
        2,
      );

    const medianMarketProbability =
      round(
        median(
          normalizedProbabilities,
        ),
        2,
      );

    const marketEdge =
      round(
        modelSelection.probability -
          medianMarketProbability,
        2,
      );

    const expectedValue =
      calculateExpectedValue(
        modelSelection.probability,
        bestQuote.decimalOdds,
      );

    const fullKellyPercentage =
      calculateKellyPercentage(
        modelSelection.probability,
        bestQuote.decimalOdds,
      );

    const halfKellyPercentage =
      round(
        fullKellyPercentage /
          2,
        2,
      );

    const quarterKellyPercentage =
      round(
        fullKellyPercentage /
          4,
        2,
      );

    const recommendedStakePercentage =
      round(
        Math.min(
          quarterKellyPercentage,
          options
            .maximumRecommendedStakePercentage,
        ),
        2,
      );

    const oldestSourceUpdate =
  validQuotes.reduce(
    (
      oldest,
      quote,
    ) =>
      quote.sourceUpdatedAt <
      oldest
        ? quote.sourceUpdatedAt
        : oldest,
    validQuotes[0]
      .sourceUpdatedAt,
  );

const oldestCapture =
  validQuotes.reduce(
    (
      oldest,
      quote,
    ) =>
      quote.capturedAt <
      oldest
        ? quote.capturedAt
        : oldest,
    validQuotes[0]
      .capturedAt,
  );

const freshness =
  evaluateOddsFreshness({
    now,

    kickoffAt:
      match.kickoffAt,

    sourceUpdatedAt:
      oldestSourceUpdate,

    capturedAt:
      oldestCapture,

    maximumCaptureAgeMinutes:
      options
        .maximumCaptureAgeMinutes,
  });

    const isValueBet =
      validQuotes.length >=
        options
          .minimumBookmakerCount &&
      modelSelection.probability >=
        options
          .minimumModelProbability &&
      bestQuote.decimalOdds >=
        options.minimumOdds &&
      bestQuote.decimalOdds <=
        options.maximumOdds &&
      marketEdge >=
        options
          .minimumMarketEdge &&
      expectedValue >=
        options
          .minimumExpectedValue;

    const publishDecision =
      resolvePublishStatus({
        isValueBet,

        criticalWarningCount:
          criticalWarnings.length,

        validBookmakerCount:
          validQuotes.length,

        sourceOddsAgeMinutes:
  freshness
    .sourceOddsAgeMinutes,

captureAgeMinutes:
  freshness
    .captureAgeMinutes,

allowedSourceOddsAgeMinutes:
  freshness
    .allowedSourceOddsAgeMinutes,

sourceIsFresh:
  freshness
    .sourceIsFresh,

captureIsFresh:
  freshness
    .captureIsFresh,

        marketEdge,

        expectedValue,

        engineOptions:
          options,
      });

    const valueLevel =
      resolveValueLevel(
        expectedValue,
        marketEdge,
      );

    const valueScore =
      calculateValueScore({
        modelProbability:
          modelSelection.probability,

        marketEdge,

        expectedValue,

        bookmakerCount:
          validQuotes.length,

        predictionConfidence:
          prediction
            .combinedConfidenceScore,
      });

    comparisons.push({
      matchId,

      marketKey,

      market:
        modelSelection.market,

      selection:
        modelSelection.selection,

      modelProbability:
        modelSelection.probability,

      modelFairOdds:
        modelSelection.fairOdds,

      bookmakerCount:
        quotes.length,

      validBookmakerCount:
        validQuotes.length,

      bestBookmakerId:
        bestQuote.bookmakerId,

      bestBookmakerName:
        bestQuote.bookmakerName,

      bestOdds:
        bestQuote.decimalOdds,

      medianOdds,

      averageOdds,

      medianMarketProbability,

      averageMarketProbability,

      marketEdge,

      expectedValue,

      fullKellyPercentage,

      halfKellyPercentage,

      quarterKellyPercentage,

      recommendedStakePercentage,

      valueScore,

      valueLevel,

      publishStatus:
        publishDecision
          .publishStatus,

      publishReasons:
        publishDecision
          .publishReasons,

      isValueBet,

      isPublishable:
        publishDecision
          .publishStatus ===
        "PUBLISHABLE",

      sourceOddsAgeMinutes:
  freshness
    .sourceOddsAgeMinutes,

captureAgeMinutes:
  freshness
    .captureAgeMinutes,

allowedSourceOddsAgeMinutes:
  freshness
    .allowedSourceOddsAgeMinutes,

oddsAgeMinutes:
  freshness
    .sourceOddsAgeMinutes,

      quotes:
        sortedQuotes,

      validQuotes:
        sortedValidQuotes,
    });
  }

  comparisons.sort(
    (
      first,
      second,
    ) => {
      const statusPriority:
        Record<
          ValueBetPublishStatus,
          number
        > = {
        PUBLISHABLE:
          0,

        REVIEW:
          1,

        BLOCKED:
          2,
      };

      const statusDifference =
        statusPriority[
          first.publishStatus
        ] -
        statusPriority[
          second.publishStatus
        ];

      if (
        statusDifference !==
        0
      ) {
        return statusDifference;
      }

      if (
        first.isValueBet !==
        second.isValueBet
      ) {
        return first.isValueBet
          ? -1
          : 1;
      }

      return (
        second.valueScore -
        first.valueScore
      );
    },
  );

  const valueBets =
    comparisons.filter(
      (
        comparison,
      ) =>
        comparison.isValueBet,
    );

  const publishableValueBets =
    valueBets.filter(
      (
        comparison,
      ) =>
        comparison.publishStatus ===
        "PUBLISHABLE",
    );

  const reviewValueBets =
    valueBets.filter(
      (
        comparison,
      ) =>
        comparison.publishStatus ===
        "REVIEW",
    );

  const blockedValueBets =
    valueBets.filter(
      (
        comparison,
      ) =>
        comparison.publishStatus ===
        "BLOCKED",
    );

  const resultWarnings =
    [...warnings];

  if (
    latestSnapshots.length ===
    0
  ) {
    resultWarnings.push(
      "Bu maç için güncel bookmaker snapshot verisi bulunamadı.",
    );
  }

  if (
    comparisons.length ===
    0
  ) {
    resultWarnings.push(
      "Model marketleri ile bookmaker marketleri eşleştirilemedi.",
    );
  }

  if (
    valueBets.length ===
      0 &&
    comparisons.length >
      0
  ) {
    resultWarnings.push(
      "Bu maçta mevcut filtreleri geçen pozitif Value Bet bulunamadı.",
    );
  }

  if (
    valueBets.length >
      0 &&
    publishableValueBets.length ===
      0
  ) {
    resultWarnings.push(
      "Matematiksel Value Bet bulundu; ancak hiçbir seçim yayın güvenlik kontrollerini geçemedi.",
    );
  }

  return {
    match: {
      id:
        match.id,

      apiId:
        match.apiId,

      kickoffAt:
        match.kickoffAt,

      homeTeam:
        match.homeTeam.name,

      awayTeam:
        match.awayTeam.name,

      leagueName:
        match.season.league.name,
    },

    model: {
      predictionVersion:
        prediction
          .model
          .probabilityModelVersion,

      marketVersion:
        originalMarketModel
          .model
          .version,

      ratingVersion:
        prediction
          .model
          .ratingModelVersion,
    },

    options,

    comparisonCount:
      comparisons.length,

    valueBetCount:
      valueBets.length,

    publishableValueBetCount:
      publishableValueBets.length,

    reviewValueBetCount:
      reviewValueBets.length,

    blockedValueBetCount:
      blockedValueBets.length,

    criticalWarningCount:
      criticalWarnings.length,

    comparisons,

    valueBets,

    publishableValueBets,

    reviewValueBets,

    blockedValueBets,

    warnings: [
      ...new Set(
        resultWarnings,
      ),
    ],
  };
}
