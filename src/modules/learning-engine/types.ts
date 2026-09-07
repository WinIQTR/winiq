export type MatchOutcome =
  | "HOME"
  | "DRAW"
  | "AWAY";

export type TrainingFeatureValues = Record<
  string,
  number
>;

export type TrainingMatchRow = {
  matchId: number;
  matchApiId: number;

  seasonId: number;
  seasonYear: number;

  leagueId: number;
  leagueApiId: number;
  leagueName: string;

  kickoffAt: Date;

  homeTeamId: number;
  homeTeamName: string;

  awayTeamId: number;
  awayTeamName: string;

  homeScore: number;
  awayScore: number;

  actualOutcome: MatchOutcome;

  features: TrainingFeatureValues;

  availableFeatureCount: number;
  missingFeatureCount: number;

  averageDataQualityScore: number | null;

  containsPostMatchCalculatedFeatures: boolean;
};

export type TrainingDataCollectionOptions = {
  leagueApiId: number;
  seasonYear: number;

  featureKeys?: string[];

  includeExperimentalFeatures?: boolean;

  strictPreMatchOnly?: boolean;

  minimumDataQualityScore?: number;

  limit?: number;
};

export type TrainingDataCollectionResult = {
  leagueApiId: number;
  seasonYear: number;

  rows: TrainingMatchRow[];

  totalFinishedMatches: number;
  collectedMatchCount: number;
  skippedMatchCount: number;

  featureKeys: string[];

  warnings: string[];
};

export type MissingValueStrategy =
  | "ZERO"
  | "COLUMN_MEAN";

export type TrainingMatrixBuildOptions = {
  /*
   * HOME ve AWAY değerlerini ayrı ayrı modele vermek için:
   * includeSideFeatures: true
   *
   * Yalnızca aradaki farkı kullanmak için:
   * includeDifferenceFeatures: true
   */
  includeSideFeatures?: boolean;
  includeDifferenceFeatures?: boolean;

  missingValueStrategy?: MissingValueStrategy;

  /*
   * Bir satırdaki eksik sütun oranı bu değeri aşarsa
   * satır eğitim matrisine alınmaz.
   *
   * 0.5 = sütunların en fazla %50'si eksik olabilir.
   */
  maximumMissingRatio?: number;
};

export type TrainingMatrixRowMetadata = {
  matchId: number;
  matchApiId: number;

  kickoffAt: Date;

  leagueApiId: number;
  seasonYear: number;

  homeTeamId: number;
  homeTeamName: string;

  awayTeamId: number;
  awayTeamName: string;

  homeScore: number;
  awayScore: number;

  actualOutcome: MatchOutcome;

  containsPostMatchCalculatedFeatures: boolean;
};

export type TrainingMatrix = {
  featureNames: string[];

  /*
   * X: Makine öğrenmesi giriş matrisi.
   *
   * Satır = maç
   * Sütun = feature
   */
  X: number[][];

  /*
   * Çok sınıflı sayısal hedef:
   *
   * HOME = 0
   * DRAW = 1
   * AWAY = 2
   */
  y: number[];

  /*
   * One-hot hedef:
   *
   * HOME = [1, 0, 0]
   * DRAW = [0, 1, 0]
   * AWAY = [0, 0, 1]
   */
  yOneHot: number[][];

  metadata: TrainingMatrixRowMetadata[];

  rowCount: number;
  columnCount: number;

  skippedRowCount: number;
  imputedValueCount: number;

  missingValueStrategy: MissingValueStrategy;

  columnMeans: Record<string, number>;

  warnings: string[];
};
export type ChronologicalSplitOptions = {
  trainingPercentage?: number;

  minimumTrainingRows?: number;
  minimumValidationRows?: number;
};

export type TrainingMatrixPartition = {
  featureNames: string[];

  X: number[][];
  y: number[][];
  yClass: number[];

  metadata: TrainingMatrixRowMetadata[];

  rowCount: number;

  startedAt: Date;
  endedAt: Date;
};

export type ChronologicalTrainingSplit = {
  training: TrainingMatrixPartition;
  validation: TrainingMatrixPartition;

  trainingPercentage: number;
  validationPercentage: number;

  splitIndex: number;
  splitDate: Date;

  totalRowCount: number;

  warnings: string[];
};

export type OutcomeProbability = {
  home: number;
  draw: number;
  away: number;
};

export type OutcomePerformance = {
  outcome: MatchOutcome;

  actualCount: number;
  predictedCount: number;
  correctCount: number;

  recallPercentage: number | null;
  precisionPercentage: number | null;
};

export type BaselineEvaluationMetrics = {
  evaluatedMatchCount: number;

  correctPredictionCount: number;
  incorrectPredictionCount: number;

  accuracyPercentage: number;

  brierScore: number;
  logLoss: number;

  predictedProbabilities: OutcomeProbability;
  predictedOutcome: MatchOutcome;

  outcomePerformance: OutcomePerformance[];
};

export type BaselineEvaluationResult = {
  trainingRowCount: number;
  validationRowCount: number;

  trainingOutcomeDistribution: {
    homeCount: number;
    drawCount: number;
    awayCount: number;

    homePercentage: number;
    drawPercentage: number;
    awayPercentage: number;
  };

  validationMetrics: BaselineEvaluationMetrics;

  warnings: string[];
};

export type SimpleLearningClassWeights = {
  HOME: number;
  DRAW: number;
  AWAY: number;
};

export type SimpleLearningModelConfig = {
  featureNames?: string[];

  learningRate?: number;
  maximumEpochs?: number;

  l2Regularization?: number;

  convergenceTolerance?: number;

  classWeights?:
    SimpleLearningClassWeights;
};

export type FeatureStandardization = {
  featureName: string;
  mean: number;
  standardDeviation: number;
};
export type SimpleLearningModel = {
  featureNames: string[];

  /*
   * Satırlar:
   * 0 = HOME
   * 1 = DRAW
   * 2 = AWAY
   *
   * Her satırdaki ilk değer bias değeridir.
   * Sonraki değerler feature katsayılarıdır.
   */
  weights: number[][];

  standardization:
    FeatureStandardization[];

  epochsCompleted: number;
  finalTrainingLoss: number;

  configuration: Required<SimpleLearningModelConfig>;
};

export type LearnedOutcomeMetrics = {
  outcome: MatchOutcome;

  actualCount: number;
  predictedCount: number;
  correctCount: number;

  recallPercentage: number | null;
  precisionPercentage: number | null;
};

export type LearnedModelEvaluation = {
  evaluatedMatchCount: number;

  correctPredictionCount: number;
  incorrectPredictionCount: number;

  accuracyPercentage: number;

  brierScore: number;
  logLoss: number;

  averageConfidencePercentage: number;

  outcomePerformance:
    LearnedOutcomeMetrics[];
};

export type SimpleLearningResult = {
  model: SimpleLearningModel;

  trainingMetrics:
    LearnedModelEvaluation;

  validationMetrics:
    LearnedModelEvaluation;

  baselineAccuracyPercentage: number | null;

  validationAccuracyImprovement:
    number | null;

  validationPredictions: Array<{
    matchId: number;
    match: string;

    actualOutcome: MatchOutcome;
    predictedOutcome: MatchOutcome;

    homeProbability: number;
    drawProbability: number;
    awayProbability: number;

    confidencePercentage: number;
    isCorrect: boolean;
  }>;

  warnings: string[];
};