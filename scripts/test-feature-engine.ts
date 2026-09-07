import { calculateFeatureScore } from "../src/modules/feature-engine";

const result = calculateFeatureScore([
  {
    key: "last_5_points_per_game",
    name: "Son 5 Maç Puan Ortalaması",
    rawValue: 2.4,
    minimumValue: 0,
    maximumValue: 3,
    higherIsBetter: true,
    weight: 0.2,
    dataQualityScore: 100,
    freshnessScore: 100,
  },
  {
    key: "goals_scored_per_game",
    name: "Gol Ortalaması",
    rawValue: 2.1,
    minimumValue: 0,
    maximumValue: 4,
    higherIsBetter: true,
    weight: 0.15,
    dataQualityScore: 100,
    freshnessScore: 95,
  },
  {
    key: "goals_conceded_per_game",
    name: "Yenilen Gol Ortalaması",
    rawValue: 0.8,
    minimumValue: 0,
    maximumValue: 4,
    higherIsBetter: false,
    weight: 0.15,
    dataQualityScore: 100,
    freshnessScore: 100,
  },
  {
    key: "starting_eleven_quality",
    name: "İlk 11 Kalite Puanı",
    rawValue: null,
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,
    weight: 0.2,
    dataQualityScore: 0,
    freshnessScore: 0,
  },
  {
    key: "expected_goals_difference",
    name: "xG Farkı",
    rawValue: null,
    minimumValue: -3,
    maximumValue: 3,
    higherIsBetter: true,
    weight: 0.2,
    dataQualityScore: 0,
    freshnessScore: 0,
  },
  {
    key: "rest_days",
    name: "Dinlenme Günü",
    rawValue: 6,
    minimumValue: 1,
    maximumValue: 10,
    higherIsBetter: true,
    weight: 0.1,
    dataQualityScore: 100,
    freshnessScore: 100,
  },
]);

console.log("\nFEATURE ENGINE TEST SONUCU\n");
console.log(
  JSON.stringify(
    {
      score: result.score,
      confidenceScore: result.confidenceScore,
      weightCoveragePercentage:
        result.weightCoveragePercentage,
      usedFeatureCount: result.usedFeatureCount,
      missingFeatureCount: result.missingFeatureCount,
      invalidFeatureCount: result.invalidFeatureCount,
    },
    null,
    2,
  ),
);

console.log("\nKRİTER KATKILARI\n");

for (const contribution of result.contributions) {
  console.log({
    key: contribution.key,
    status: contribution.status,
    rawValue: contribution.rawValue,
    normalizedValue: contribution.normalizedValue,
    effectiveWeight: contribution.effectiveWeight,
  });
}