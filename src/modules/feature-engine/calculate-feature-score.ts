import { normalizeFeatureValue } from "./normalize-feature-value";
import type {
  FeatureContribution,
  FeatureInput,
  FeatureScoreResult,
} from "./types";

function clampScore(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateFeatureScore(
  features: FeatureInput[],
): FeatureScoreResult {
  const totalConfiguredWeight = features.reduce(
    (total, feature) =>
      feature.weight > 0 ? total + feature.weight : total,
    0,
  );

  const contributions: FeatureContribution[] = [];

  let availableConfiguredWeight = 0;
  let totalEffectiveWeight = 0;
  let weightedScoreTotal = 0;
  let weightedReliabilityTotal = 0;

  for (const feature of features) {
    const dataQualityScore = clampScore(
      feature.dataQualityScore ?? 100,
    );

    const freshnessScore = clampScore(
      feature.freshnessScore ?? 100,
    );

    if (feature.rawValue === null) {
      contributions.push({
        key: feature.key,
        name: feature.name,
        status: "MISSING",
        rawValue: null,
        normalizedValue: null,
        configuredWeight: feature.weight,
        effectiveWeight: 0,
        weightedContribution: 0,
        dataQualityScore,
        freshnessScore,
        message: "Bu özellik için veri bulunamadı.",
      });

      continue;
    }

    if (
      !Number.isFinite(feature.rawValue) ||
      feature.weight <= 0 ||
      feature.maximumValue <= feature.minimumValue
    ) {
      contributions.push({
        key: feature.key,
        name: feature.name,
        status: "INVALID",
        rawValue: feature.rawValue,
        normalizedValue: null,
        configuredWeight: feature.weight,
        effectiveWeight: 0,
        weightedContribution: 0,
        dataQualityScore,
        freshnessScore,
        message: "Özellik yapılandırması veya değeri geçersiz.",
      });

      continue;
    }

    const normalizedValue = normalizeFeatureValue({
      rawValue: feature.rawValue,
      minimumValue: feature.minimumValue,
      maximumValue: feature.maximumValue,
      higherIsBetter: feature.higherIsBetter,
    });

    const reliabilityMultiplier =
      (dataQualityScore / 100) *
      (freshnessScore / 100);

    const effectiveWeight =
      feature.weight * reliabilityMultiplier;

    const weightedContribution =
      normalizedValue * effectiveWeight;

    availableConfiguredWeight += feature.weight;
    totalEffectiveWeight += effectiveWeight;
    weightedScoreTotal += weightedContribution;
    weightedReliabilityTotal +=
      reliabilityMultiplier * feature.weight;

    contributions.push({
      key: feature.key,
      name: feature.name,
      status: "AVAILABLE",
      rawValue: feature.rawValue,
      normalizedValue,
      configuredWeight: feature.weight,
      effectiveWeight: round(effectiveWeight, 4),
      weightedContribution: round(weightedContribution, 4),
      dataQualityScore,
      freshnessScore,
    });
  }

  const score =
    totalEffectiveWeight > 0
      ? round(weightedScoreTotal / totalEffectiveWeight)
      : null;

  const weightCoverage =
    totalConfiguredWeight > 0
      ? availableConfiguredWeight / totalConfiguredWeight
      : 0;

  const averageReliability =
    availableConfiguredWeight > 0
      ? weightedReliabilityTotal /
        availableConfiguredWeight
      : 0;

  /*
   * Güven puanının %70'i veri kapsamından,
   * %30'u mevcut verinin kalitesi ve güncelliğinden gelir.
   */
  const confidenceScore = round(
    clampScore(
      weightCoverage * 70 +
        averageReliability * 30,
    ),
  );

  return {
    score,
    confidenceScore,
    totalConfiguredWeight: round(totalConfiguredWeight, 4),
    availableConfiguredWeight: round(
      availableConfiguredWeight,
      4,
    ),
    effectiveWeight: round(totalEffectiveWeight, 4),
    weightCoveragePercentage: round(weightCoverage * 100),
    usedFeatureCount: contributions.filter(
      (item) => item.status === "AVAILABLE",
    ).length,
    missingFeatureCount: contributions.filter(
      (item) => item.status === "MISSING",
    ).length,
    invalidFeatureCount: contributions.filter(
      (item) => item.status === "INVALID",
    ).length,
    contributions,
  };
}