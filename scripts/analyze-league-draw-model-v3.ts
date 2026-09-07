import "dotenv/config";

import {
  ACTIVE_COMPETITION_API_IDS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import type {
  MatchOutcome,
  OutcomeProbabilities,
} from "@/modules/probability-engine";

type DatasetName =
  | "TRAIN"
  | "VALIDATION"
  | "TEST";

type DrawRule = {
  leagueApiId: number;
  leagueName: string;
  name: string;
  drawBoost: number;
  matches: (row: AnalysisRow) => boolean;
};

type AnalysisRow = {
  dataset: DatasetName;
  matchId: number;
  kickoffAt: Date;
  leagueApiId: number;
  leagueName: string;
  actualOutcome: MatchOutcome;
  baseline: OutcomeProbabilities;
  adjusted: OutcomeProbabilities;
  appliedRule: string | null;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  totalXg: number;
  xgGap: number;
  homeAwayGap: number;
};

type Metrics = {
  matches: number;
  correct: number;
  accuracy: number;
  brierScore: number;
  drawBrierScore: number;
  logLoss: number;
  predictedDraws: number;
  correctPredictedDraws: number;
  actualDraws: number;
  drawPrecision: number;
  drawRecall: number;
  averageDrawProbability: number;
};

const SEASON_YEAR =
  2024;

const TRAIN_RATIO =
  0.6;

const VALIDATION_RATIO =
  0.2;

const EPSILON =
  1e-15;

/*
 * V2 bağımsız test audit'inden sonra incelemeye alınan kurallar.
 *
 * Her ligde en fazla bir kural uygulanır. Bu nedenle boost'lar üst üste
 * eklenmez. +2 yüzde puanlık sabit artış özellikle küçük tutulmuştur;
 * V3'ün amacı production ayarı yapmak değil, kontrollü model karşılaştırmasıdır.
 *
 * Bilerek dışarıda bırakılan kural:
 * Süper Lig - HOME_AWAY_GAP<=15 (bağımsız testte negatif sonuç verdi).
 */
const DRAW_RULES: DrawRule[] = [
  {
    leagueApiId: 203,
    leagueName: "Süper Lig",
    name: "DRAW>=22",
    drawBoost: 2,
    matches: (row) =>
      row.baseline.draw >= 22,
  },
  {
    leagueApiId: 135,
    leagueName: "Serie A",
    name: "DRAW>=26 + XG_GAP<=0.35",
    drawBoost: 2,
    matches: (row) =>
      row.baseline.draw >= 26 &&
      row.xgGap <= 0.35,
  },
  {
    leagueApiId: 61,
    leagueName: "Ligue 1",
    name: "DRAW>=26 + XG_GAP<=0.35",
    drawBoost: 2,
    matches: (row) =>
      row.baseline.draw >= 26 &&
      row.xgGap <= 0.35,
  },
];

function round(
  value: number,
  decimals = 4,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function percentage(
  numerator: number,
  denominator: number,
): number {
  if (denominator === 0) {
    return 0;
  }

  return round(
    (numerator / denominator) * 100,
    2,
  );
}

function actualOutcomeFromScore(
  homeScore: number,
  awayScore: number,
): MatchOutcome {
  if (homeScore > awayScore) {
    return "HOME";
  }

  if (homeScore < awayScore) {
    return "AWAY";
  }

  return "DRAW";
}

function resolveDataset(
  index: number,
  total: number,
): DatasetName {
  const trainEnd =
    Math.floor(total * TRAIN_RATIO);

  const validationEnd =
    Math.floor(
      total * (TRAIN_RATIO + VALIDATION_RATIO),
    );

  if (index < trainEnd) {
    return "TRAIN";
  }

  if (index < validationEnd) {
    return "VALIDATION";
  }

  return "TEST";
}

function normalizeProbabilities(
  probabilities: OutcomeProbabilities,
): OutcomeProbabilities {
  const total =
    probabilities.home +
    probabilities.draw +
    probabilities.away;

  if (total <= 0) {
    return {
      home: 100 / 3,
      draw: 100 / 3,
      away: 100 / 3,
    };
  }

  return {
    home: (probabilities.home / total) * 100,
    draw: (probabilities.draw / total) * 100,
    away: (probabilities.away / total) * 100,
  };
}

function applyDrawBoost(
  probabilities: OutcomeProbabilities,
  drawBoost: number,
): OutcomeProbabilities {
  const normalized =
    normalizeProbabilities(probabilities);

  const adjustedDraw =
    Math.min(
      99.98,
      Math.max(
        0.01,
        normalized.draw + drawBoost,
      ),
    );

  const originalNonDrawTotal =
    normalized.home + normalized.away;

  if (originalNonDrawTotal <= 0) {
    const remaining =
      100 - adjustedDraw;

    return {
      home: remaining / 2,
      draw: adjustedDraw,
      away: remaining / 2,
    };
  }

  const remaining =
    100 - adjustedDraw;

  const homeShare =
    normalized.home / originalNonDrawTotal;

  return {
    home: remaining * homeShare,
    draw: adjustedDraw,
    away: remaining * (1 - homeShare),
  };
}

function predictedOutcome(
  probabilities: OutcomeProbabilities,
): MatchOutcome {
  const entries: Array<
    [MatchOutcome, number]
  > = [
    ["HOME", probabilities.home],
    ["DRAW", probabilities.draw],
    ["AWAY", probabilities.away],
  ];

  entries.sort(
    (left, right) =>
      right[1] - left[1],
  );

  return entries[0][0];
}

function actualProbability(
  probabilities: OutcomeProbabilities,
  actualOutcome: MatchOutcome,
): number {
  if (actualOutcome === "HOME") {
    return probabilities.home;
  }

  if (actualOutcome === "DRAW") {
    return probabilities.draw;
  }

  return probabilities.away;
}

function calculateMetrics(
  rows: AnalysisRow[],
  probabilityKey: "baseline" | "adjusted",
): Metrics {
  if (rows.length === 0) {
    return {
      matches: 0,
      correct: 0,
      accuracy: 0,
      brierScore: 0,
      drawBrierScore: 0,
      logLoss: 0,
      predictedDraws: 0,
      correctPredictedDraws: 0,
      actualDraws: 0,
      drawPrecision: 0,
      drawRecall: 0,
      averageDrawProbability: 0,
    };
  }

  let correct = 0;
  let brierTotal = 0;
  let drawBrierTotal = 0;
  let logLossTotal = 0;
  let predictedDraws = 0;
  let correctPredictedDraws = 0;
  let actualDraws = 0;
  let drawProbabilityTotal = 0;

  for (const row of rows) {
    const probabilities =
      normalizeProbabilities(row[probabilityKey]);

    const prediction =
      predictedOutcome(probabilities);

    if (prediction === row.actualOutcome) {
      correct += 1;
    }

    if (prediction === "DRAW") {
      predictedDraws += 1;

      if (row.actualOutcome === "DRAW") {
        correctPredictedDraws += 1;
      }
    }

    if (row.actualOutcome === "DRAW") {
      actualDraws += 1;
    }

    const homeTarget =
      row.actualOutcome === "HOME" ? 1 : 0;

    const drawTarget =
      row.actualOutcome === "DRAW" ? 1 : 0;

    const awayTarget =
      row.actualOutcome === "AWAY" ? 1 : 0;

    const homeProbability =
      probabilities.home / 100;

    const drawProbability =
      probabilities.draw / 100;

    const awayProbability =
      probabilities.away / 100;

    brierTotal +=
      (homeProbability - homeTarget) ** 2 +
      (drawProbability - drawTarget) ** 2 +
      (awayProbability - awayTarget) ** 2;

    drawBrierTotal +=
      (drawProbability - drawTarget) ** 2;

    const observedProbability =
      Math.min(
        1 - EPSILON,
        Math.max(
          EPSILON,
          actualProbability(
            probabilities,
            row.actualOutcome,
          ) / 100,
        ),
      );

    logLossTotal +=
      -Math.log(observedProbability);

    drawProbabilityTotal +=
      probabilities.draw;
  }

  return {
    matches: rows.length,
    correct,
    accuracy: percentage(correct, rows.length),
    brierScore: round(brierTotal / rows.length, 6),
    drawBrierScore: round(
      drawBrierTotal / rows.length,
      6,
    ),
    logLoss: round(logLossTotal / rows.length, 6),
    predictedDraws,
    correctPredictedDraws,
    actualDraws,
    drawPrecision: percentage(
      correctPredictedDraws,
      predictedDraws,
    ),
    drawRecall: percentage(
      correctPredictedDraws,
      actualDraws,
    ),
    averageDrawProbability: round(
      drawProbabilityTotal / rows.length,
      4,
    ),
  };
}

function metricComparison(
  baseline: Metrics,
  adjusted: Metrics,
): Array<Record<string, unknown>> {
  return [
    {
      metric: "Accuracy (%)",
      better: "HIGHER",
      baseline: baseline.accuracy,
      adjusted: adjusted.accuracy,
      change: round(
        adjusted.accuracy - baseline.accuracy,
      ),
    },
    {
      metric: "Brier Score",
      better: "LOWER",
      baseline: baseline.brierScore,
      adjusted: adjusted.brierScore,
      change: round(
        adjusted.brierScore - baseline.brierScore,
        6,
      ),
    },
    {
      metric: "Draw Brier Score",
      better: "LOWER",
      baseline: baseline.drawBrierScore,
      adjusted: adjusted.drawBrierScore,
      change: round(
        adjusted.drawBrierScore - baseline.drawBrierScore,
        6,
      ),
    },
    {
      metric: "Log Loss",
      better: "LOWER",
      baseline: baseline.logLoss,
      adjusted: adjusted.logLoss,
      change: round(
        adjusted.logLoss - baseline.logLoss,
        6,
      ),
    },
    {
      metric: "Predicted draws",
      better: "INFO",
      baseline: baseline.predictedDraws,
      adjusted: adjusted.predictedDraws,
      change:
        adjusted.predictedDraws - baseline.predictedDraws,
    },
    {
      metric: "Correct predicted draws",
      better: "HIGHER",
      baseline: baseline.correctPredictedDraws,
      adjusted: adjusted.correctPredictedDraws,
      change:
        adjusted.correctPredictedDraws -
        baseline.correctPredictedDraws,
    },
    {
      metric: "Draw precision (%)",
      better: "HIGHER",
      baseline: baseline.drawPrecision,
      adjusted: adjusted.drawPrecision,
      change: round(
        adjusted.drawPrecision - baseline.drawPrecision,
      ),
    },
    {
      metric: "Draw recall (%)",
      better: "HIGHER",
      baseline: baseline.drawRecall,
      adjusted: adjusted.drawRecall,
      change: round(
        adjusted.drawRecall - baseline.drawRecall,
      ),
    },
    {
      metric: "Average draw probability (%)",
      better: "INFO",
      baseline: baseline.averageDrawProbability,
      adjusted: adjusted.averageDrawProbability,
      change: round(
        adjusted.averageDrawProbability -
          baseline.averageDrawProbability,
      ),
    },
  ];
}

function modelDecision(
  baseline: Metrics,
  adjusted: Metrics,
): Record<string, unknown> {
  const brierImproved =
    adjusted.brierScore < baseline.brierScore;

  const drawBrierImproved =
    adjusted.drawBrierScore < baseline.drawBrierScore;

  const logLossImproved =
    adjusted.logLoss < baseline.logLoss;

  const accuracyNotWorse =
    adjusted.accuracy >= baseline.accuracy;

  const passed =
    brierImproved &&
    drawBrierImproved &&
    logLossImproved &&
    accuracyNotWorse;

  return {
    "Brier improved": brierImproved ? "YES" : "NO",
    "Draw Brier improved": drawBrierImproved ? "YES" : "NO",
    "Log Loss improved": logLossImproved ? "YES" : "NO",
    "Accuracy not worse": accuracyNotWorse ? "YES" : "NO",
    Decision: passed
      ? "PASS - NEXT VALIDATION STAGE"
      : "REJECT - DO NOT ADD TO PRODUCTION",
  };
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "LEAGUE-AWARE DRAW MODEL V3 COMPARISON",
  );
  console.log(
    "==============================================",
  );

  console.table({
    Season: SEASON_YEAR,
    "Train ratio": `${TRAIN_RATIO * 100}%`,
    "Validation ratio": `${VALIDATION_RATIO * 100}%`,
    "Test ratio": `${round(
      (1 - TRAIN_RATIO - VALIDATION_RATIO) * 100,
      2,
    )}%`,
    "Fixed draw boost": "+2 percentage points",
    "Rule stacking": "DISABLED",
  });

  console.log("");
  console.log("FIXED RULES UNDER TEST");
  console.table(
    DRAW_RULES.map((rule) => ({
      leagueApiId: rule.leagueApiId,
      league: rule.leagueName,
      rule: rule.name,
      drawBoost: rule.drawBoost,
    })),
  );

  const matches =
    await prisma.match.findMany({
      where: {
        status: "FINISHED",
        homeScore: {
          not: null,
        },
        awayScore: {
          not: null,
        },
        season: {
          year: SEASON_YEAR,
          league: {
            apiId: {
              in: [
                ...ACTIVE_COMPETITION_API_IDS,
              ],
            },
          },
        },
      },
      orderBy: [
        {
          kickoffAt: "asc",
        },
        {
          id: "asc",
        },
      ],
      select: {
        id: true,
        kickoffAt: true,
        homeScore: true,
        awayScore: true,
        season: {
          select: {
            league: {
              select: {
                apiId: true,
                name: true,
              },
            },
          },
        },
      },
    });

  if (matches.length < 100) {
    throw new Error(
      `Yeterli historical maç bulunamadı: ${matches.length}`,
    );
  }

  const rows: AnalysisRow[] = [];

  const failures: Array<
    Record<string, unknown>
  > = [];

  for (
    let index = 0;
    index < matches.length;
    index += 1
  ) {
    const match = matches[index];

    if (
      match.homeScore === null ||
      match.awayScore === null
    ) {
      continue;
    }

    try {
      const result =
        await calculateGoalProbabilities(match.id);

      const baseline =
        normalizeProbabilities({
          home: result.outcomeProbabilities.home,
          draw: result.outcomeProbabilities.draw,
          away: result.outcomeProbabilities.away,
        });

      const actualOutcome =
        actualOutcomeFromScore(
          match.homeScore,
          match.awayScore,
        );

      const expectedHomeGoals =
        result.expectedGoals.home;

      const expectedAwayGoals =
        result.expectedGoals.away;

      const row: AnalysisRow = {
        dataset: resolveDataset(
          index,
          matches.length,
        ),
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        leagueApiId:
          match.season.league.apiId,
        leagueName:
          match.season.league.name,
        actualOutcome,
        baseline,
        adjusted: baseline,
        appliedRule: null,
        expectedHomeGoals,
        expectedAwayGoals,
        totalXg: round(
          expectedHomeGoals + expectedAwayGoals,
        ),
        xgGap: round(
          Math.abs(
            expectedHomeGoals - expectedAwayGoals,
          ),
        ),
        homeAwayGap: round(
          Math.abs(baseline.home - baseline.away),
        ),
      };

      const applicableRule =
        DRAW_RULES.find(
          (rule) =>
            rule.leagueApiId === row.leagueApiId &&
            rule.matches(row),
        );

      if (applicableRule) {
        row.adjusted =
          applyDrawBoost(
            row.baseline,
            applicableRule.drawBoost,
          );

        row.appliedRule =
          applicableRule.name;
      }

      rows.push(row);

      if ((index + 1) % 100 === 0) {
        console.log(
          `ANALYSIS ${index + 1}/${matches.length}`,
        );
      }
    } catch (error: unknown) {
      failures.push({
        matchId: match.id,
        league: match.season.league.name,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  const trainRows =
    rows.filter((row) => row.dataset === "TRAIN");

  const validationRows =
    rows.filter(
      (row) => row.dataset === "VALIDATION",
    );

  const testRows =
    rows.filter((row) => row.dataset === "TEST");

  const affectedTestRows =
    testRows.filter(
      (row) => row.appliedRule !== null,
    );

  console.log("");
  console.log(
    "==============================================",
  );
  console.log("DATASET SUMMARY");
  console.log(
    "==============================================",
  );
  console.table({
    Matches: rows.length,
    Failures: failures.length,
    TRAIN: trainRows.length,
    VALIDATION: validationRows.length,
    TEST: testRows.length,
    "Affected TEST matches": affectedTestRows.length,
    "Unaffected TEST matches":
      testRows.length - affectedTestRows.length,
  });

  if (testRows.length === 0) {
    throw new Error("TEST veri bölümü boş.");
  }

  const baselineAllTest =
    calculateMetrics(testRows, "baseline");

  const adjustedAllTest =
    calculateMetrics(testRows, "adjusted");

  const baselineAffectedTest =
    calculateMetrics(
      affectedTestRows,
      "baseline",
    );

  const adjustedAffectedTest =
    calculateMetrics(
      affectedTestRows,
      "adjusted",
    );

  console.log("");
  console.log(
    "==============================================",
  );
  console.log("ALL TEST MATCHES - MODEL COMPARISON");
  console.log(
    "==============================================",
  );
  console.table(
    metricComparison(
      baselineAllTest,
      adjustedAllTest,
    ),
  );

  console.log("");
  console.log(
    "==============================================",
  );
  console.log("AFFECTED TEST MATCHES - MODEL COMPARISON");
  console.log(
    "==============================================",
  );

  if (affectedTestRows.length === 0) {
    console.log(
      "Seçili kurallara uyan TEST maçı bulunamadı.",
    );
  } else {
    console.table(
      metricComparison(
        baselineAffectedTest,
        adjustedAffectedTest,
      ),
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );
  console.log("RULE-BY-RULE TEST AUDIT");
  console.log(
    "==============================================",
  );

  const ruleAudit =
    DRAW_RULES.map((rule) => {
      const selected =
        testRows.filter(
          (row) =>
            row.leagueApiId === rule.leagueApiId &&
            row.appliedRule === rule.name,
        );

      const baselineMetrics =
        calculateMetrics(selected, "baseline");

      const adjustedMetrics =
        calculateMetrics(selected, "adjusted");

      const actualDraws =
        selected.filter(
          (row) => row.actualOutcome === "DRAW",
        ).length;

      return {
        leagueApiId: rule.leagueApiId,
        league: rule.leagueName,
        rule: rule.name,
        matches: selected.length,
        actualDraws,
        actualDrawRate: percentage(
          actualDraws,
          selected.length,
        ),
        baselineDrawProbability:
          baselineMetrics.averageDrawProbability,
        adjustedDrawProbability:
          adjustedMetrics.averageDrawProbability,
        baselineBrier:
          baselineMetrics.brierScore,
        adjustedBrier:
          adjustedMetrics.brierScore,
        brierChange: round(
          adjustedMetrics.brierScore -
            baselineMetrics.brierScore,
          6,
        ),
        baselineDrawBrier:
          baselineMetrics.drawBrierScore,
        adjustedDrawBrier:
          adjustedMetrics.drawBrierScore,
        drawBrierChange: round(
          adjustedMetrics.drawBrierScore -
            baselineMetrics.drawBrierScore,
          6,
        ),
        baselineLogLoss:
          baselineMetrics.logLoss,
        adjustedLogLoss:
          adjustedMetrics.logLoss,
        logLossChange: round(
          adjustedMetrics.logLoss -
            baselineMetrics.logLoss,
          6,
        ),
      };
    });

  console.table(ruleAudit);

  console.log("");
  console.log(
    "==============================================",
  );
  console.log("MODEL DECISION");
  console.log(
    "==============================================",
  );
  console.table(
    modelDecision(
      baselineAllTest,
      adjustedAllTest,
    ),
  );

  console.log("");
  console.log(
    "Not: TEST sonuçları V2 audit sırasında görülmüştü.",
  );
  console.log(
    "Bu nedenle PASS sonucu doğrudan production onayı değildir.",
  );
  console.log(
    "PASS yalnızca yeni sezon/out-of-time doğrulamasına geçiş iznidir.",
  );

  if (failures.length > 0) {
    console.log("");
    console.log("FAILURES");
    console.table(failures.slice(0, 30));
  }

  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "LEAGUE-AWARE DRAW MODEL V3 COMPARISON TAMAMLANDI",
  );
  console.log(
    "==============================================",
  );
}

main()
  .catch((error: unknown) => {
    console.error("");
    console.error(
      "League-Aware DRAW Model V3 karşılaştırması başarısız.",
    );
    console.error(
      error instanceof Error
        ? error.message
        : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
