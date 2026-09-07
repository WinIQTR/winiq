export type FeatureInput = {
  key: string;
  name: string;

  /**
   * Ham özellik değeri.
   * null: veri bulunamadı; sıfır anlamına gelmez.
   */
  rawValue: number | null;

  /**
   * Normalizasyon sınırları.
   */
  minimumValue: number;
  maximumValue: number;

  /**
   * true: yüksek değer daha iyi.
   * false: düşük değer daha iyi.
   */
  higherIsBetter: boolean;

  /**
   * Modeldeki başlangıç ağırlığı.
   * Örnek: 0.15
   */
  weight: number;

  /**
   * Verinin güvenilirliği: 0–100.
   */
  dataQualityScore?: number;

  /**
   * Verinin güncelliği: 0–100.
   * Eski veri düşük puan alabilir.
   */
  freshnessScore?: number;
};

export type FeatureContributionStatus =
  | "AVAILABLE"
  | "MISSING"
  | "INVALID";

export type FeatureContribution = {
  key: string;
  name: string;
  status: FeatureContributionStatus;
  rawValue: number | null;
  normalizedValue: number | null;
  configuredWeight: number;
  effectiveWeight: number;
  weightedContribution: number;
  dataQualityScore: number;
  freshnessScore: number;
  message?: string;
};

export type FeatureScoreResult = {
  /**
   * Mevcut özelliklerle hesaplanan 0–100 analiz puanı.
   * Hiç kullanılabilir özellik yoksa null.
   */
  score: number | null;

  /**
   * Kapsam, veri kalitesi ve güncellik esaslı 0–100 güven puanı.
   */
  confidenceScore: number;

  totalConfiguredWeight: number;
  availableConfiguredWeight: number;
  effectiveWeight: number;
  weightCoveragePercentage: number;
  usedFeatureCount: number;
  missingFeatureCount: number;
  invalidFeatureCount: number;
  contributions: FeatureContribution[];
};