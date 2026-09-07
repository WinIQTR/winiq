import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import {
  buildTrainingMatrix,
  collectTrainingData,
  trainSimpleLearningModel,
} from "@/modules/learning-engine";

import type {
  MatchOutcome,
  OutcomeProbabilities,
  ProbabilityConfidenceLevel,
} from "@/modules/probability-engine";

import {
  applyDrawDecisionLayer,
} from "@/modules/prediction-engine/draw-decision-layer";

import {
  calculatePoissonConfidence,
} from "@/modules/prediction-engine/poisson-confidence";

const TRAIN_SEASON_YEAR = 2024;
const TEST_SEASON_YEAR = 2025;

const ML_WEIGHT = 0.2;
const POISSON_WEIGHT = 0.8;

const MINIMUM_TEST_MATCHES = 100;
const POLICY_SELECTION_RATIO = 0.6;
const MINIMUM_POLICY_SAMPLE = 40;
const MINIMUM_OUTCOME_POLICY_SAMPLE = 25;
const MINIMUM_FINAL_HOLDOUT_SAMPLE = 20;
const MINIMUM_DATA_QUALITY = 65;

const PROBABILITY_THRESHOLDS = [
  50,
  55,
  60,
  65,
] as const;

const MINIMUM_VENUE_MATCH_THRESHOLDS = [
  0,
  3,
  5,
  8,
] as const;

const CORE_FEATURES = [
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",
  "rest_days",
  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",
] as const;

const OUTCOMES: MatchOutcome[] = [
  "HOME",
  "DRAW",
  "AWAY",
];

type TrainingMatrix = ReturnType<
  typeof buildTrainingMatrix
>;

type TrainingRows = Awaited<
  ReturnType<typeof collectTrainingData>
>["rows"];

type GoalModel = Awaited<
  ReturnType<typeof calculateGoalProbabilities>
>;

type ComponentRow = {
  matchId: number;
  leagueApiId: number;
  leagueName: string;
  kickoffAt: Date;
  actualOutcome: MatchOutcome;
  mlProbabilities: OutcomeProbabilities;
  poissonProbabilities: OutcomeProbabilities;
  goalModel: GoalModel;
};

type SelectionRow = {
  matchId: number;
  leagueApiId: number;
  leagueName: string;
  kickoffAt: Date;
  actualOutcome: MatchOutcome;
  predictedOutcome: MatchOutcome;
  predictedProbability: number;
  probabilities: OutcomeProbabilities;
  correct: boolean;
  confidenceScore: number;
  confidenceLevel: ProbabilityConfidenceLevel;
  dataQualityScore: number;
  probabilityGap: number;
  leagueMatches: number;
  homeVenueMatches: number;
  awayVenueMatches: number;
  minimumVenueMatches: number;
  drawAuditWouldApply: boolean;
  drawProbability: number;
  drawGap: number;
};

type CompetitionCollectionResult = {
  leagueApiId: number;
  leagueName: string;
  trainingRows: number;
  testRows: number;
  trainingStatus: string;
  testStatus: string;
};

type PolicyMetrics = {
  matches: number;
  correct: number;
  wrong: number;
  accuracy: number;
  coverage: number;
  averageProbability: number;
  averageConfidence: number;
  averageDataQuality: number;
  homeSelections: number;
  homeAccuracy: number;
  awaySelections: number;
  awayAccuracy: number;
};

type PolicyScope = "HOME_AND_AWAY" | "HOME_ONLY" | "AWAY_ONLY";

type PolicyDefinition = {
  scope: PolicyScope;
  minimumProbability: number;
  minimumVenueMatches: number;
};

type EvaluatedPolicy = PolicyDefinition & PolicyMetrics & {
  wilsonLowerBound: number;
  sampleGate: "PASS" | "LOW SAMPLE";
};

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalize(
  probabilities: OutcomeProbabilities,
): OutcomeProbabilities {
  const total =
    probabilities.home +
    probabilities.draw +
    probabilities.away;

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return {
      home: 33.33,
      draw: 33.34,
      away: 33.33,
    };
  }

  return {
    home: probabilities.home / total * 100,
    draw: probabilities.draw / total * 100,
    away: probabilities.away / total * 100,
  };
}

function blend(
  ml: OutcomeProbabilities,
  poisson: OutcomeProbabilities,
): OutcomeProbabilities {
  return normalize({
    home:
      ml.home * ML_WEIGHT +
      poisson.home * POISSON_WEIGHT,
    draw:
      ml.draw * ML_WEIGHT +
      poisson.draw * POISSON_WEIGHT,
    away:
      ml.away * ML_WEIGHT +
      poisson.away * POISSON_WEIGHT,
  });
}

function getTopPrediction(
  probabilities: OutcomeProbabilities,
): {
  outcome: MatchOutcome;
  probability: number;
} {
  const candidates: Array<{
    outcome: MatchOutcome;
    probability: number;
  }> = [
    {
      outcome: "HOME",
      probability: probabilities.home,
    },
    {
      outcome: "DRAW",
      probability: probabilities.draw,
    },
    {
      outcome: "AWAY",
      probability: probabilities.away,
    },
  ];

  candidates.sort(
    (left, right) =>
      right.probability - left.probability,
  );

  return candidates[0];
}

function getNumericField(
  value: unknown,
  field: string,
): number {
  if (
    typeof value === "object" &&
    value !== null &&
    field in value
  ) {
    const candidate =
      (value as Record<string, unknown>)[field];

    if (
      typeof candidate === "number" &&
      Number.isFinite(candidate)
    ) {
      return candidate;
    }
  }

  throw new Error(
    `${field} alanı bulunamadı veya sayısal değil.`,
  );
}

function getStringField(
  value: unknown,
  field: string,
  fallback: string,
): string {
  if (
    typeof value === "object" &&
    value !== null &&
    field in value
  ) {
    const candidate =
      (value as Record<string, unknown>)[field];

    if (
      typeof candidate === "string" &&
      candidate.trim().length > 0
    ) {
      return candidate;
    }
  }

  return fallback;
}

function classIndexToOutcome(
  classIndex: number,
): MatchOutcome {
  const outcome = OUTCOMES[classIndex];

  if (!outcome) {
    throw new Error(
      `Geçersiz sonuç sınıfı: ${classIndex}.`,
    );
  }

  return outcome;
}

function formatDate(
  value: Date,
): string {
  return Number.isFinite(value.getTime())
    ? value.toISOString()
    : "GEÇERSİZ TARİH";
}

function chronologicalIndices(
  matrix: TrainingMatrix,
  indices: number[],
): number[] {
  return [...indices].sort(
    (left, right) => {
      const timeDifference =
        matrix.metadata[left].kickoffAt.getTime() -
        matrix.metadata[right].kickoffAt.getTime();

      return timeDifference || left - right;
    },
  );
}

function buildPartition(
  matrix: TrainingMatrix,
  indices: number[],
) {
  if (indices.length === 0) {
    throw new Error(
      "Boş training/test partition oluşturulamaz.",
    );
  }

  const sorted = chronologicalIndices(
    matrix,
    indices,
  );

  return {
    featureNames: matrix.featureNames,
    X: sorted.map((index) => matrix.X[index]),
    y: sorted.map((index) => matrix.yOneHot[index]),
    yClass: sorted.map((index) => matrix.y[index]),
    metadata: sorted.map(
      (index) => matrix.metadata[index],
    ),
    rowCount: sorted.length,
    startedAt: matrix.metadata[sorted[0]].kickoffAt,
    endedAt:
      matrix.metadata[
        sorted[sorted.length - 1]
      ].kickoffAt,
  };
}

async function collectSeasonRows(
  seasonYear: number,
  competitionApiId: number,
): Promise<TrainingRows> {
  const result = await collectTrainingData({
    leagueApiId: competitionApiId,
    seasonYear,
    featureKeys: [...CORE_FEATURES],
    minimumDataQualityScore: 0,
    strictPreMatchOnly: true,
  });

  return result.rows;
}

function average(
  rows: SelectionRow[],
  selector: (row: SelectionRow) => number,
): number {
  if (rows.length === 0) {
    return 0;
  }

  return round(
    rows.reduce(
      (sum, row) => sum + selector(row),
      0,
    ) / rows.length,
  );
}

function outcomeAccuracy(
  rows: SelectionRow[],
  outcome: "HOME" | "AWAY",
): number {
  const selected = rows.filter(
    (row) => row.predictedOutcome === outcome,
  );

  if (selected.length === 0) {
    return 0;
  }

  const correct = selected.filter(
    (row) => row.correct,
  ).length;

  return round(correct / selected.length * 100);
}

function evaluatePolicy(
  selected: SelectionRow[],
  allRows: SelectionRow[],
): PolicyMetrics {
  const correct = selected.filter(
    (row) => row.correct,
  ).length;

  const homeSelections = selected.filter(
    (row) => row.predictedOutcome === "HOME",
  ).length;

  const awaySelections = selected.filter(
    (row) => row.predictedOutcome === "AWAY",
  ).length;

  return {
    matches: selected.length,
    correct,
    wrong: selected.length - correct,
    accuracy: selected.length > 0
      ? round(correct / selected.length * 100)
      : 0,
    coverage: allRows.length > 0
      ? round(selected.length / allRows.length * 100)
      : 0,
    averageProbability: average(
      selected,
      (row) => row.predictedProbability,
    ),
    averageConfidence: average(
      selected,
      (row) => row.confidenceScore,
    ),
    averageDataQuality: average(
      selected,
      (row) => row.dataQualityScore,
    ),
    homeSelections,
    homeAccuracy: outcomeAccuracy(
      selected,
      "HOME",
    ),
    awaySelections,
    awayAccuracy: outcomeAccuracy(
      selected,
      "AWAY",
    ),
  };
}

function isHighConfidence(
  row: SelectionRow,
): boolean {
  return (
    row.confidenceLevel === "HIGH" ||
    row.confidenceLevel === "VERY_HIGH"
  );
}

function passesPolicy(
  row: SelectionRow,
  policy: PolicyDefinition,
): boolean {
  const outcomeMatches =
    policy.scope === "HOME_AND_AWAY"
      ? row.predictedOutcome !== "DRAW"
      : policy.scope === "HOME_ONLY"
      ? row.predictedOutcome === "HOME"
      : row.predictedOutcome === "AWAY";

  return (
    outcomeMatches &&
    row.predictedProbability >= policy.minimumProbability &&
    isHighConfidence(row) &&
    row.dataQualityScore >= MINIMUM_DATA_QUALITY &&
    row.homeVenueMatches >= policy.minimumVenueMatches &&
    row.awayVenueMatches >= policy.minimumVenueMatches
  );
}

function getMinimumPolicySample(
  scope: PolicyScope,
): number {
  return scope === "HOME_AND_AWAY"
    ? MINIMUM_POLICY_SAMPLE
    : MINIMUM_OUTCOME_POLICY_SAMPLE;
}

function wilsonLowerBound(
  correct: number,
  total: number,
): number {
  if (total === 0) {
    return 0;
  }

  const z = 1.96;
  const proportion = correct / total;
  const zSquared = z ** 2;
  const denominator = 1 + zSquared / total;
  const centre =
    proportion + zSquared / (2 * total);
  const margin =
    z * Math.sqrt(
      (proportion * (1 - proportion) +
        zSquared / (4 * total)) /
        total,
    );

  return round(
    (centre - margin) / denominator * 100,
  );
}

function evaluateDefinition(
  policy: PolicyDefinition,
  rows: SelectionRow[],
): EvaluatedPolicy {
  const selected = rows.filter(
    (row) => passesPolicy(row, policy),
  );
  const metrics = evaluatePolicy(selected, rows);
  const minimumSample = getMinimumPolicySample(
    policy.scope,
  );

  return {
    ...policy,
    ...metrics,
    wilsonLowerBound: wilsonLowerBound(
      metrics.correct,
      metrics.matches,
    ),
    sampleGate:
      metrics.matches >= minimumSample
        ? "PASS"
        : "LOW SAMPLE",
  };
}

function buildPolicyGrid(
  rows: SelectionRow[],
  scope: PolicyScope,
): EvaluatedPolicy[] {
  return PROBABILITY_THRESHOLDS.flatMap(
    (minimumProbability) =>
      MINIMUM_VENUE_MATCH_THRESHOLDS.map(
        (minimumVenueMatches) =>
          evaluateDefinition(
            {
              scope,
              minimumProbability,
              minimumVenueMatches,
            },
            rows,
          ),
      ),
  );
}

function choosePolicy(
  grid: EvaluatedPolicy[],
): EvaluatedPolicy | null {
  const eligible = grid.filter(
    (policy) => policy.sampleGate === "PASS",
  );

  eligible.sort(
    (left, right) =>
      right.wilsonLowerBound - left.wilsonLowerBound ||
      right.accuracy - left.accuracy ||
      right.matches - left.matches ||
      right.minimumProbability - left.minimumProbability ||
      left.minimumVenueMatches - right.minimumVenueMatches,
  );

  return eligible[0] ?? null;
}

function policyLabel(
  policy: PolicyDefinition | null,
): string {
  if (!policy) {
    return "YETERLİ ÖRNEKLEM YOK";
  }

  return [
    policy.scope,
    `P>=${policy.minimumProbability}`,
    "HIGH+",
    `Data>=${MINIMUM_DATA_QUALITY}`,
    `Venue>=${policy.minimumVenueMatches}`,
  ].join(" • ");
}

function buildConfidenceSummary(
  rows: SelectionRow[],
) {
  const levels: ProbabilityConfidenceLevel[] = [
    "VERY_HIGH",
    "HIGH",
    "MEDIUM",
    "LOW",
    "VERY_LOW",
  ];

  return levels.map((level) => {
    const levelRows = rows.filter(
      (row) => row.confidenceLevel === level,
    );

    return {
      level,
      ...evaluatePolicy(levelRows, rows),
    };
  });
}

function buildDataQualitySummary(
  rows: SelectionRow[],
) {
  const buckets = [
    {
      label: "0-49.99",
      minimum: 0,
      maximum: 50,
    },
    {
      label: "50-64.99",
      minimum: 50,
      maximum: 65,
    },
    {
      label: "65-79.99",
      minimum: 65,
      maximum: 80,
    },
    {
      label: "80-100",
      minimum: 80,
      maximum: 101,
    },
  ];

  return buckets.map((bucket) => {
    const bucketRows = rows.filter(
      (row) =>
        row.dataQualityScore >= bucket.minimum &&
        row.dataQualityScore < bucket.maximum,
    );

    return {
      dataQuality: bucket.label,
      ...evaluatePolicy(bucketRows, rows),
    };
  });
}

function buildLeagueSummary(
  rows: SelectionRow[],
) {
  const groups = new Map<
    number,
    SelectionRow[]
  >();

  for (const row of rows) {
    const current = groups.get(row.leagueApiId) ?? [];
    current.push(row);
    groups.set(row.leagueApiId, current);
  }

  return [...groups.entries()]
    .map(([leagueApiId, leagueRows]) => ({
      leagueApiId,
      league: leagueRows[0].leagueName,
      ...evaluatePolicy(leagueRows, rows),
      actualDraws: leagueRows.filter(
        (row) => row.actualOutcome === "DRAW",
      ).length,
      predictedDraws: leagueRows.filter(
        (row) => row.predictedOutcome === "DRAW",
      ).length,
      drawAuditSignals: leagueRows.filter(
        (row) => row.drawAuditWouldApply,
      ).length,
    }))
    .sort(
      (left, right) => right.matches - left.matches,
    );
}

function buildDrawAuditSummary(
  rows: SelectionRow[],
) {
  const auditRows = rows.filter(
    (row) => row.drawAuditWouldApply,
  );

  const actualDraws = rows.filter(
    (row) => row.actualOutcome === "DRAW",
  ).length;

  const auditCorrectDraws = auditRows.filter(
    (row) => row.actualOutcome === "DRAW",
  ).length;

  const productionCorrectOnAuditRows = auditRows.filter(
    (row) => row.correct,
  ).length;

  const counterfactualDelta =
    auditCorrectDraws - productionCorrectOnAuditRows;

  return {
    testMatches: rows.length,
    actualDraws,
    auditSignals: auditRows.length,
    auditCorrectDraws,
    auditWrongSignals:
      auditRows.length - auditCorrectDraws,
    auditPrecision: auditRows.length > 0
      ? round(auditCorrectDraws / auditRows.length * 100)
      : 0,
    auditRecall: actualDraws > 0
      ? round(auditCorrectDraws / actualDraws * 100)
      : 0,
    productionCorrectOnAuditRows,
    productionAccuracyOnAuditRows: auditRows.length > 0
      ? round(
          productionCorrectOnAuditRows /
            auditRows.length *
            100,
        )
      : 0,
    counterfactualDrawCorrect: auditCorrectDraws,
    counterfactualAccuracyOnAuditRows: auditRows.length > 0
      ? round(auditCorrectDraws / auditRows.length * 100)
      : 0,
    counterfactualCorrectDelta: counterfactualDelta,
    conclusion: counterfactualDelta > 0
      ? "DRAW override bu örneklemde daha iyi; yine de production değişmez."
      : counterfactualDelta < 0
      ? "DRAW override bu örneklemde daha kötü; audit-only korunmalı."
      : "DRAW override bu örneklemde ek doğruluk sağlamıyor.",
  };
}

async function main(): Promise<void> {
  console.log("");
  console.log("==============================================");
  console.log("PRODUCTION SELECTION POLICY V2 — NESTED HOLDOUT");
  console.log("==============================================");

  console.table({
    "Eğitim sezonu": TRAIN_SEASON_YEAR,
    "Politika doğrulama sezonu": TEST_SEASON_YEAR,
    "Politika seçim bölümü": `%${round(POLICY_SELECTION_RATIO * 100)}`,
    "Nihai holdout bölümü": `%${round((1 - POLICY_SELECTION_RATIO) * 100)}`,
    "Production olasılığı": "%20 ML / %80 Poisson",
    "DRAW davranışı": "AUDIT ONLY — tahmini değiştirmez",
    "Eksik değer yöntemi": "ZERO",
    "Production ayarı değiştirme": "YOK",
  });

  const trainingRows: TrainingRows = [];
  const testRows: TrainingRows = [];
  const collectionResults: CompetitionCollectionResult[] = [];

  for (const competition of ACTIVE_COMPETITIONS) {
    let leagueTrainingRows: TrainingRows = [];
    let leagueTestRows: TrainingRows = [];
    let trainingStatus = "OK";
    let testStatus = "OK";

    try {
      leagueTrainingRows = await collectSeasonRows(
        TRAIN_SEASON_YEAR,
        competition.apiId,
      );
      trainingRows.push(...leagueTrainingRows);

      if (leagueTrainingRows.length === 0) {
        trainingStatus = "NO ELIGIBLE ROWS";
      }
    } catch (error: unknown) {
      trainingStatus = error instanceof Error
        ? `SKIPPED: ${error.message}`
        : "SKIPPED: UNKNOWN ERROR";
    }

    try {
      leagueTestRows = await collectSeasonRows(
        TEST_SEASON_YEAR,
        competition.apiId,
      );
      testRows.push(...leagueTestRows);

      if (leagueTestRows.length === 0) {
        testStatus = "NO ELIGIBLE ROWS";
      }
    } catch (error: unknown) {
      testStatus = error instanceof Error
        ? `SKIPPED: ${error.message}`
        : "SKIPPED: UNKNOWN ERROR";
    }

    collectionResults.push({
      leagueApiId: competition.apiId,
      leagueName: competition.name,
      trainingRows: leagueTrainingRows.length,
      testRows: leagueTestRows.length,
      trainingStatus,
      testStatus,
    });
  }

  console.log("");
  console.log("DATA COLLECTION BY COMPETITION");
  console.table(collectionResults);

  if (trainingRows.length === 0) {
    throw new Error(
      `${TRAIN_SEASON_YEAR} eğitim verisi bulunamadı.`,
    );
  }

  if (testRows.length === 0) {
    throw new Error(
      `${TEST_SEASON_YEAR} test verisi bulunamadı. ` +
      "Tamamlanmış maçları ve pre-match snapshot'ları kontrol edin.",
    );
  }

  const trainingMatchIds = new Set(
    trainingRows.map(
      (row) => getNumericField(row, "matchId"),
    ),
  );

  const testMatchIds = new Set(
    testRows.map(
      (row) => getNumericField(row, "matchId"),
    ),
  );

  const overlappingMatchIds = [...testMatchIds].filter(
    (matchId) => trainingMatchIds.has(matchId),
  );

  if (overlappingMatchIds.length > 0) {
    throw new Error(
      `${overlappingMatchIds.length} maç hem eğitim hem test kümesinde bulundu.`,
    );
  }

  const matrix = buildTrainingMatrix(
    [...trainingRows, ...testRows],
    {
      includeSideFeatures: false,
      includeDifferenceFeatures: true,
      missingValueStrategy: "ZERO",
      maximumMissingRatio: 0.5,
    },
  );

  const trainingIndices: number[] = [];
  const testIndices: number[] = [];
  const unknownIndices: number[] = [];

  for (
    let index = 0;
    index < matrix.rowCount;
    index += 1
  ) {
    const matchId = getNumericField(
      matrix.metadata[index],
      "matchId",
    );

    if (trainingMatchIds.has(matchId)) {
      trainingIndices.push(index);
    } else if (testMatchIds.has(matchId)) {
      testIndices.push(index);
    } else {
      unknownIndices.push(index);
    }
  }

  if (unknownIndices.length > 0) {
    throw new Error(
      `${unknownIndices.length} matrix satırı sezona eşleştirilemedi.`,
    );
  }

  const training = buildPartition(
    matrix,
    trainingIndices,
  );

  const validation = buildPartition(
    matrix,
    testIndices,
  );

  const temporalSeparation =
    training.endedAt.getTime() <
    validation.startedAt.getTime();

  if (!temporalSeparation) {
    throw new Error(
      "Eğitim ve test dönemleri kronolojik olarak ayrılmıyor.",
    );
  }

  if (validation.rowCount < MINIMUM_TEST_MATCHES) {
    throw new Error(
      `Test örneklemi yetersiz: ${validation.rowCount}. ` +
      `Minimum ${MINIMUM_TEST_MATCHES} maç gerekli.`,
    );
  }

  console.log("");
  console.log("STRICT SEASON BOUNDARIES");
  console.table([
    {
      partition: "TRAIN ONLY",
      seasonYear: TRAIN_SEASON_YEAR,
      matches: training.rowCount,
      firstMatch: formatDate(training.startedAt),
      lastMatch: formatDate(training.endedAt),
    },
    {
      partition: "UNTOUCHED TEST ONLY",
      seasonYear: TEST_SEASON_YEAR,
      matches: validation.rowCount,
      firstMatch: formatDate(validation.startedAt),
      lastMatch: formatDate(validation.endedAt),
    },
  ]);

  const split = {
    training,
    validation,
    trainingPercentage:
      training.rowCount /
      (training.rowCount + validation.rowCount) *
      100,
    validationPercentage:
      validation.rowCount /
      (training.rowCount + validation.rowCount) *
      100,
    splitIndex: training.rowCount,
    splitDate: validation.startedAt,
    totalRowCount:
      training.rowCount + validation.rowCount,
    warnings: [],
  };

  const mlResult = trainSimpleLearningModel(split);

  const metadataByMatchId = new Map(
    validation.metadata.map((metadata) => [
      getNumericField(metadata, "matchId"),
      metadata,
    ]),
  );

  const componentRows: ComponentRow[] = [];

  for (
    let index = 0;
    index < mlResult.validationPredictions.length;
    index += 1
  ) {
    const ml = mlResult.validationPredictions[index];
    const metadata = metadataByMatchId.get(ml.matchId);

    if (!metadata) {
      throw new Error(
        `Test metadata bulunamadı. matchId=${ml.matchId}`,
      );
    }

    const goalModel = await calculateGoalProbabilities(
      ml.matchId,
    );

    componentRows.push({
      matchId: ml.matchId,
      leagueApiId: getNumericField(
        metadata,
        "leagueApiId",
      ),
      leagueName: getStringField(
        metadata,
        "leagueName",
        `League ${getNumericField(metadata, "leagueApiId")}`,
      ),
      kickoffAt: metadata.kickoffAt,
      actualOutcome: ml.actualOutcome,
      mlProbabilities: normalize({
        home: ml.homeProbability,
        draw: ml.drawProbability,
        away: ml.awayProbability,
      }),
      poissonProbabilities: normalize(
        goalModel.outcomeProbabilities,
      ),
      goalModel,
    });

    if ((index + 1) % 100 === 0) {
      console.log(
        `SELECTION POLICY ANALYSIS ${index + 1}/${mlResult.validationPredictions.length}`,
      );
    }
  }

  const selectionRows: SelectionRow[] =
    componentRows.map((component) => {
      const finalProbabilities = blend(
        component.mlProbabilities,
        component.poissonProbabilities,
      );

      const finalPrediction = getTopPrediction(
        finalProbabilities,
      );

      const drawAudit = applyDrawDecisionLayer({
        probabilities: finalProbabilities,
      });

      /*
       * Production DRAW audit-only davranışı birebir taklit edilir.
       * Audit sinyali raporlanır fakat confidence cezası uygulanmaz
       * ve seçilen 1X2 sonucu değiştirilmez.
       */
      const productionDrawDecision = {
        ...drawAudit,
        applied: false,
        selectedOutcome: finalPrediction.outcome,
        selectedProbability: finalPrediction.probability,
      };

      const confidence = calculatePoissonConfidence({
        goalModel: component.goalModel,
        probabilities: finalProbabilities,
        finalOutcome: finalPrediction.outcome,
        drawDecision: productionDrawDecision,
      });

      return {
        matchId: component.matchId,
        leagueApiId: component.leagueApiId,
        leagueName: component.leagueName,
        kickoffAt: component.kickoffAt,
        actualOutcome: component.actualOutcome,
        predictedOutcome: finalPrediction.outcome,
        predictedProbability: finalPrediction.probability,
        probabilities: finalProbabilities,
        correct:
          finalPrediction.outcome ===
          component.actualOutcome,
        confidenceScore: confidence.score,
        confidenceLevel: confidence.level,
        dataQualityScore: confidence.dataQualityScore,
        probabilityGap: confidence.probabilityGap,
        leagueMatches: confidence.dataQuality.leagueMatches,
        homeVenueMatches:
          confidence.dataQuality.homeVenueMatches,
        awayVenueMatches:
          confidence.dataQuality.awayVenueMatches,
        minimumVenueMatches:
          confidence.dataQuality.minimumVenueMatches,
        drawAuditWouldApply: drawAudit.applied,
        drawProbability: drawAudit.drawProbability,
        drawGap: drawAudit.drawGap,
      };
    });

  const chronologicalRows = [...selectionRows].sort(
    (left, right) =>
      left.kickoffAt.getTime() - right.kickoffAt.getTime() ||
      left.matchId - right.matchId,
  );

  const policySplitIndex = Math.floor(
    chronologicalRows.length * POLICY_SELECTION_RATIO,
  );
  const policySelectionRows = chronologicalRows.slice(
    0,
    policySplitIndex,
  );
  const finalHoldoutRows = chronologicalRows.slice(
    policySplitIndex,
  );

  if (
    policySelectionRows.length < MINIMUM_TEST_MATCHES ||
    finalHoldoutRows.length < MINIMUM_TEST_MATCHES
  ) {
    throw new Error(
      "2025 nested holdout bölümlerinden biri yetersiz örnekleme sahip.",
    );
  }

  const policyEnd =
    policySelectionRows[policySelectionRows.length - 1].kickoffAt;
  const holdoutStart = finalHoldoutRows[0].kickoffAt;

  if (policyEnd.getTime() > holdoutStart.getTime()) {
    throw new Error(
      "Politika seçimi ve final holdout kronolojik olarak ayrılmıyor.",
    );
  }

  console.log("");
  console.log("==============================================");
  console.log("NESTED CHRONOLOGICAL BOUNDARIES");
  console.log("==============================================");
  console.table([
    {
      partition: "POLICY SELECTION ONLY",
      matches: policySelectionRows.length,
      firstMatch: formatDate(policySelectionRows[0].kickoffAt),
      lastMatch: formatDate(policyEnd),
    },
    {
      partition: "FINAL UNTOUCHED HOLDOUT",
      matches: finalHoldoutRows.length,
      firstMatch: formatDate(holdoutStart),
      lastMatch: formatDate(
        finalHoldoutRows[finalHoldoutRows.length - 1].kickoffAt,
      ),
    },
  ]);

  const basePolicyMetrics = evaluatePolicy(
    policySelectionRows,
    policySelectionRows,
  );
  const baseHoldoutMetrics = evaluatePolicy(
    finalHoldoutRows,
    finalHoldoutRows,
  );

  console.log("");
  console.log("==============================================");
  console.log("BASE PRODUCTION RESULTS BY PARTITION");
  console.log("==============================================");
  console.table([
    {
      partition: "POLICY SELECTION",
      ...basePolicyMetrics,
    },
    {
      partition: "FINAL HOLDOUT",
      ...baseHoldoutMetrics,
    },
  ]);

  const scopes: PolicyScope[] = [
    "HOME_AND_AWAY",
    "HOME_ONLY",
    "AWAY_ONLY",
  ];

  const grids = new Map<PolicyScope, EvaluatedPolicy[]>();
  const chosenPolicies = new Map<
    PolicyScope,
    EvaluatedPolicy | null
  >();

  for (const scope of scopes) {
    const grid = buildPolicyGrid(
      policySelectionRows,
      scope,
    );
    grids.set(scope, grid);
    chosenPolicies.set(scope, choosePolicy(grid));

    console.log("");
    console.log(`POLICY SELECTION GRID — ${scope}`);
    console.table(grid);
  }

  const finalPolicyResults = scopes.map((scope) => {
    const selected = chosenPolicies.get(scope) ?? null;

    if (!selected) {
      return {
        scope,
        selectedPolicy: "YETERLİ ÖRNEKLEM YOK",
        selectionMatches: 0,
        selectionAccuracy: 0,
        selectionWilsonLowerBound: 0,
        holdoutMatches: 0,
        holdoutCorrect: 0,
        holdoutAccuracy: 0,
        holdoutWilsonLowerBound: 0,
        finalSampleGate: "FAIL",
      };
    }

    const holdout = evaluateDefinition(
      selected,
      finalHoldoutRows,
    );

    return {
      scope,
      selectedPolicy: policyLabel(selected),
      selectionMatches: selected.matches,
      selectionAccuracy: selected.accuracy,
      selectionWilsonLowerBound: selected.wilsonLowerBound,
      holdoutMatches: holdout.matches,
      holdoutCorrect: holdout.correct,
      holdoutAccuracy: holdout.accuracy,
      holdoutWilsonLowerBound: holdout.wilsonLowerBound,
      finalSampleGate:
        holdout.matches >= MINIMUM_FINAL_HOLDOUT_SAMPLE
          ? "PASS"
          : "LOW SAMPLE",
    };
  });

  console.log("");
  console.log("==============================================");
  console.log("SELECTED POLICIES — FINAL UNTOUCHED HOLDOUT");
  console.log("==============================================");
  console.table(finalPolicyResults);

  const fixedPolicies: PolicyDefinition[] = [
    {
      scope: "HOME_AND_AWAY",
      minimumProbability: 60,
      minimumVenueMatches: 0,
    },
    {
      scope: "HOME_AND_AWAY",
      minimumProbability: 60,
      minimumVenueMatches: 8,
    },
    {
      scope: "HOME_ONLY",
      minimumProbability: 60,
      minimumVenueMatches: 0,
    },
    {
      scope: "AWAY_ONLY",
      minimumProbability: 60,
      minimumVenueMatches: 0,
    },
  ];

  console.log("");
  console.log("==============================================");
  console.log("PRE-DECLARED P>=60 POLICIES — FINAL HOLDOUT");
  console.log("==============================================");
  console.table(
    fixedPolicies.map((policy) => ({
      policy: policyLabel(policy),
      ...evaluateDefinition(policy, finalHoldoutRows),
    })),
  );

  const chosenCombined =
    chosenPolicies.get("HOME_AND_AWAY") ?? null;

  console.log("");
  console.log("==============================================");
  console.log("LEAGUE VALIDATION — CHOSEN COMBINED POLICY");
  console.log("==============================================");

  if (!chosenCombined) {
    console.log("Birleşik politika seçilemedi.");
  } else {
    const leagueGroups = new Map<number, SelectionRow[]>();

    for (const row of finalHoldoutRows) {
      const current = leagueGroups.get(row.leagueApiId) ?? [];
      current.push(row);
      leagueGroups.set(row.leagueApiId, current);
    }

    console.table(
      [...leagueGroups.entries()]
        .map(([leagueApiId, leagueRows]) => {
          const selectedRows = leagueRows.filter(
            (row) => passesPolicy(row, chosenCombined),
          );
          const metrics = evaluatePolicy(
            selectedRows,
            leagueRows,
          );

          return {
            leagueApiId,
            league: leagueRows[0].leagueName,
            totalHoldoutMatches: leagueRows.length,
            ...metrics,
            wilsonLowerBound: wilsonLowerBound(
              metrics.correct,
              metrics.matches,
            ),
            sampleWarning:
              metrics.matches >= 20 ? "OK" : "LOW SAMPLE",
          };
        })
        .sort(
          (left, right) => right.matches - left.matches,
        ),
    );
  }

  console.log("");
  console.log("CONFIDENCE LEVEL — FINAL HOLDOUT");
  console.table(buildConfidenceSummary(finalHoldoutRows));

  console.log("");
  console.log("DATA QUALITY — FINAL HOLDOUT");
  console.table(buildDataQualitySummary(finalHoldoutRows));

  console.log("");
  console.log("LEAGUE BASELINE — FINAL HOLDOUT");
  console.table(buildLeagueSummary(finalHoldoutRows));

  console.log("");
  console.log("DRAW AUDIT — POLICY SELECTION VS FINAL HOLDOUT");
  console.table([
    {
      partition: "POLICY SELECTION",
      ...buildDrawAuditSummary(policySelectionRows),
    },
    {
      partition: "FINAL HOLDOUT",
      ...buildDrawAuditSummary(finalHoldoutRows),
    },
  ]);

  const combinedFinal = finalPolicyResults.find(
    (result) => result.scope === "HOME_AND_AWAY",
  );
  const finalStatus =
    combinedFinal &&
    combinedFinal.finalSampleGate === "PASS" &&
    combinedFinal.holdoutWilsonLowerBound >= 55
      ? "STRONG VALIDATION CANDIDATE"
      : combinedFinal &&
        combinedFinal.finalSampleGate === "PASS" &&
        combinedFinal.holdoutAccuracy >= 60
      ? "PROMISING — MORE VALIDATION NEEDED"
      : "NOT VALIDATED — DO NOT AUTO-PUBLISH";

  console.log("");
  console.log("==============================================");
  console.log("SELECTION POLICY V2 DECISION");
  console.log("==============================================");
  console.table({
    "20/80 production": "UNCHANGED",
    "DRAW override": "DISABLED — AUDIT ONLY",
    "Production filter auto-update": "DISABLED",
    "Seçilen birleşik politika": policyLabel(chosenCombined),
    "Final doğrulama durumu": finalStatus,
    Açıklama:
      "Politika yalnız ilk 2025 bölümünde seçildi; sonuç yalnız son kronolojik holdout ile değerlendirildi.",
  });

  console.log("");
  console.log("PRODUCTION SELECTION POLICY V2 TAMAMLANDI.");
}

main().catch((error: unknown) => {
  console.error("");
  console.error(
    "Production selection policy testi başarısız.",
  );
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );
  process.exitCode = 1;
});
