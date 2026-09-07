export type ValueBetLevel =
  | "STRONG"
  | "GOOD"
  | "WATCH"
  | "NONE";

export type ValueBetPublishStatus =
  | "PUBLISHABLE"
  | "REVIEW"
  | "BLOCKED";

export type MarketOddsQuote = {
  bookmakerId: number;
  bookmakerName: string;

  decimalOdds: number;

  impliedProbability: number;

  normalizedProbability:
    number | null;

  sourceUpdatedAt:
    Date;

  capturedAt:
    Date;
};

export type ValueBetComparison = {
  matchId: number;

  marketKey: string;
  market: string;
  selection: string;

  modelProbability: number;
  modelFairOdds: number | null;

  bookmakerCount: number;
  validBookmakerCount: number;

  bestBookmakerId: number;
  bestBookmakerName: string;

  bestOdds: number;
  medianOdds: number;
  averageOdds: number;

  medianMarketProbability: number;
  averageMarketProbability: number;

  marketEdge: number;
  expectedValue: number;

  fullKellyPercentage: number;
  halfKellyPercentage: number;
  quarterKellyPercentage: number;

  recommendedStakePercentage:
    number;

  valueScore: number;

  valueLevel:
    ValueBetLevel;

  publishStatus:
    ValueBetPublishStatus;

  publishReasons:
    string[];

  isValueBet: boolean;
  isPublishable: boolean;

  /*
   * Bookmaker oranı en son ne zaman
   * değiştirdi?
   */
  sourceOddsAgeMinutes:
    number;

  /*
   * Biz oranı API'den en son ne zaman
   * kontrol ettik?
   */
  captureAgeMinutes:
    number;

  /*
   * Maça kalan süreye göre izin verilen
   * maksimum source odds yaşı.
   */
  allowedSourceOddsAgeMinutes:
    number;

  /*
   * Eski kodlarla uyumluluk için
   * sourceOddsAgeMinutes değerini taşır.
   */
  oddsAgeMinutes:
    number;

  quotes:
    MarketOddsQuote[];

  validQuotes:
    MarketOddsQuote[];
};

export type ValueBetEngineOptions = {
  minimumBookmakerCount?:
    number;

  minimumModelProbability?:
    number;

  minimumOdds?:
    number;

  maximumOdds?:
    number;

  minimumMarketEdge?:
    number;

  minimumExpectedValue?:
    number;

  maximumRecommendedStakePercentage?:
    number;

  /*
   * Bizim API kontrolümüzün en fazla
   * kaç dakika önce yapılmış olabileceği.
   */
  maximumCaptureAgeMinutes?:
    number;

  maximumPublishableEdge?:
    number;

  maximumPublishableExpectedValue?:
    number;

  maximumCriticalWarningCount?:
    number;

  outlierTolerancePercentage?:
    number;
};

export type ValueBetEngineResult = {
  match: {
    id: number;
    apiId: number;

    kickoffAt: Date;

    homeTeam: string;
    awayTeam: string;

    leagueName: string;
  };

  model: {
    predictionVersion:
      string;

    marketVersion:
      string;

    ratingVersion:
      string;
  };

  options: Required<
    ValueBetEngineOptions
  >;

  comparisonCount:
    number;

  valueBetCount:
    number;

  publishableValueBetCount:
    number;

  reviewValueBetCount:
    number;

  blockedValueBetCount:
    number;

  criticalWarningCount:
    number;

  comparisons:
    ValueBetComparison[];

  valueBets:
    ValueBetComparison[];

  publishableValueBets:
    ValueBetComparison[];

  reviewValueBets:
    ValueBetComparison[];

  blockedValueBets:
    ValueBetComparison[];

  warnings:
    string[];
};