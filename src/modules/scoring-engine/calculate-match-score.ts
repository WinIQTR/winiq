import { prisma } from "@/lib/prisma";
import {
  ACTIVE_CALCULATION_RUN_ID,
  calculateFeatureScore,
  loadActiveFeatureModel,
} from "@/modules/feature-engine";

export type MatchEdge =
  | "STRONG_HOME"
  | "HOME"
  | "BALANCED"
  | "AWAY"
  | "STRONG_AWAY"
  | "INSUFFICIENT_DATA";

export type TeamMatchScore = {
  teamId: number;
  teamName: string;
  score: number | null;
  confidenceScore: number;
  weightCoveragePercentage: number;
  usedFeatureCount: number;
  missingFeatureCount: number;
  invalidFeatureCount: number;
  contributions: Array<{
    key: string;
    name: string;
    status: "AVAILABLE" | "MISSING" | "INVALID";
    rawValue: number | null;
    normalizedValue: number | null;
    configuredWeight: number;
    effectiveWeight: number;
    weightedContribution: number;
  }>;
};

export type MatchScoreResult = {
  match: {
    id: number;
    apiId: number;
    kickoffAt: Date;
    homeTeamId: number;
    homeTeam: string;
    awayTeamId: number;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
  };
  model: {
    id: number;
    name: string;
    version: string;
    configuredFeatureCount: number;
  };
  home: TeamMatchScore;
  away: TeamMatchScore;
  scoreDifference: number | null;
  combinedConfidenceScore: number;
  edge: MatchEdge;
};

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function determineEdge(options: {
  scoreDifference: number | null;
  combinedConfidenceScore: number;
}): MatchEdge {
  const {
    scoreDifference,
    combinedConfidenceScore,
  } = options;

  if (
    scoreDifference === null ||
    combinedConfidenceScore < 35
  ) {
    return "INSUFFICIENT_DATA";
  }

  if (scoreDifference >= 15) {
    return "STRONG_HOME";
  }

  if (scoreDifference >= 7) {
    return "HOME";
  }

  if (scoreDifference <= -15) {
    return "STRONG_AWAY";
  }

  if (scoreDifference <= -7) {
    return "AWAY";
  }

  return "BALANCED";
}

async function calculateTeamScore(options: {
  matchId: number;
  teamId: number;
  teamName: string;
  modelFeatures: Awaited<
    ReturnType<typeof loadActiveFeatureModel>
  >["features"];
}): Promise<TeamMatchScore> {
  const storedValues =
  await prisma.matchFeatureValue.findMany({
    where: {
      matchId: options.matchId,
      teamId: options.teamId,
      calculationRunId:
        ACTIVE_CALCULATION_RUN_ID,
    },
    include: {
      feature: true,
    },
    orderBy: {
      feature: {
        key: "asc",
      },
    },
  });

  /*
   * Aynı feature için ileride farklı calculationRunId
   * sürümleri bulunabilir. En güncel değeri kullanıyoruz.
   */
  const valueByFeatureKey = new Map(
  storedValues.map((value) => [
    value.feature.key,
    value,
  ]),
);

  const result = calculateFeatureScore(
    options.modelFeatures.map((modelFeature) => {
      const storedValue =
        valueByFeatureKey.get(modelFeature.key);

      return {
        key: modelFeature.key,
        name: modelFeature.name,
        rawValue: storedValue?.numericValue ?? null,
        minimumValue: modelFeature.minimumValue,
        maximumValue: modelFeature.maximumValue,
        higherIsBetter:
          modelFeature.higherIsBetter,
        weight: modelFeature.weight,
        dataQualityScore:
          storedValue?.dataQualityScore ?? 0,

        /*
         * Feature güncellik sistemi sonraki modülde
         * sourceUpdatedAt üzerinden ayrıntılı hesaplanacak.
         */
        freshnessScore:
          storedValue?.numericValue === null ||
          storedValue?.numericValue === undefined
            ? 0
            : 100,
      };
    }),
  );

  return {
    teamId: options.teamId,
    teamName: options.teamName,
    score: result.score,
    confidenceScore: result.confidenceScore,
    weightCoveragePercentage:
      result.weightCoveragePercentage,
    usedFeatureCount: result.usedFeatureCount,
    missingFeatureCount: result.missingFeatureCount,
    invalidFeatureCount: result.invalidFeatureCount,
    contributions: result.contributions.map(
      (contribution) => ({
        key: contribution.key,
        name: contribution.name,
        status: contribution.status,
        rawValue: contribution.rawValue,
        normalizedValue:
          contribution.normalizedValue,
        configuredWeight:
          contribution.configuredWeight,
        effectiveWeight:
          contribution.effectiveWeight,
        weightedContribution:
          contribution.weightedContribution,
      }),
    ),
  };
}

export async function calculateMatchScore(
  matchId: number,
): Promise<MatchScoreResult> {
  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  const match = await prisma.match.findUnique({
    where: {
      id: matchId,
    },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  if (!match) {
    throw new Error(
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  const model = await loadActiveFeatureModel();

  const [home, away] = await Promise.all([
    calculateTeamScore({
      matchId: match.id,
      teamId: match.homeTeamId,
      teamName: match.homeTeam.name,
      modelFeatures: model.features,
    }),

    calculateTeamScore({
      matchId: match.id,
      teamId: match.awayTeamId,
      teamName: match.awayTeam.name,
      modelFeatures: model.features,
    }),
  ]);

  const scoreDifference =
    home.score !== null && away.score !== null
      ? round(home.score - away.score)
      : null;

  /*
   * Maç güveni, iki takımın en zayıf veri tarafına göre
   * belirlenir. Bir takımın verisi zayıfsa genel maç
   * güveni yüksek görünmemelidir.
   */
  const combinedConfidenceScore = round(
    Math.min(
      home.confidenceScore,
      away.confidenceScore,
    ),
  );

  const edge = determineEdge({
    scoreDifference,
    combinedConfidenceScore,
  });

  return {
    match: {
      id: match.id,
      apiId: match.apiId,
      kickoffAt: match.kickoffAt,
      homeTeamId: match.homeTeamId,
      homeTeam: match.homeTeam.name,
      awayTeamId: match.awayTeamId,
      awayTeam: match.awayTeam.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    },
    model: {
      id: model.id,
      name: model.name,
      version: model.version,
      configuredFeatureCount:
        model.features.length,
    },
    home,
    away,
    scoreDifference,
    combinedConfidenceScore,
    edge,
  };
}