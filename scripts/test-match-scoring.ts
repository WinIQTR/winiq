import "dotenv/config";

import { MatchStatus } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { calculateMatchScore } from "../src/modules/scoring-engine";

function getActualResult(options: {
  homeScore: number | null;
  awayScore: number | null;
}): "HOME" | "DRAW" | "AWAY" | "UNKNOWN" {
  if (
    options.homeScore === null ||
    options.awayScore === null
  ) {
    return "UNKNOWN";
  }

  if (options.homeScore > options.awayScore) {
    return "HOME";
  }

  if (options.homeScore < options.awayScore) {
    return "AWAY";
  }

  return "DRAW";
}

async function main(): Promise<void> {
  const match = await prisma.match.findFirst({
    where: {
      status: MatchStatus.FINISHED,
      season: {
        year: 2024,
        league: {
          apiId: 39,
        },
      },
    },
    orderBy: {
      kickoffAt: "desc",
    },
  });

  if (!match) {
    throw new Error(
      "Skorlanacak Premier League maçı bulunamadı.",
    );
  }

  const result = await calculateMatchScore(match.id);

  console.log("\nMATCH SCORING ENGINE SONUCU\n");

  console.log({
    match: `${result.match.homeTeam} - ${result.match.awayTeam}`,
    kickoffAt: result.match.kickoffAt,
    actualScore:
      `${result.match.homeScore} - ${result.match.awayScore}`,
    actualResult: getActualResult({
      homeScore: result.match.homeScore,
      awayScore: result.match.awayScore,
    }),
    model: result.model.version,
    homeFeatureScore: result.home.score,
    awayFeatureScore: result.away.score,
    scoreDifference: result.scoreDifference,
    combinedConfidenceScore:
      result.combinedConfidenceScore,
    edge: result.edge,
  });

  console.log("\nEV SAHİBİ DETAYI\n");

  console.log({
    team: result.home.teamName,
    score: result.home.score,
    confidenceScore:
      result.home.confidenceScore,
    weightCoveragePercentage:
      result.home.weightCoveragePercentage,
    usedFeatureCount:
      result.home.usedFeatureCount,
    missingFeatureCount:
      result.home.missingFeatureCount,
  });

  console.log("\nDEPLASMAN DETAYI\n");

  console.log({
    team: result.away.teamName,
    score: result.away.score,
    confidenceScore:
      result.away.confidenceScore,
    weightCoveragePercentage:
      result.away.weightCoveragePercentage,
    usedFeatureCount:
      result.away.usedFeatureCount,
    missingFeatureCount:
      result.away.missingFeatureCount,
  });

  console.log("\nEN ETKİLİ EV SAHİBİ FEATURE'LARI\n");

  console.log(
    result.home.contributions
      .filter((item) => item.status === "AVAILABLE")
      .sort(
        (a, b) =>
          b.weightedContribution -
          a.weightedContribution,
      )
      .slice(0, 5)
      .map((item) => ({
        key: item.key,
        rawValue: item.rawValue,
        normalizedValue:
          item.normalizedValue,
        contribution:
          item.weightedContribution,
      })),
  );

  console.log("\nEN ETKİLİ DEPLASMAN FEATURE'LARI\n");

  console.log(
    result.away.contributions
      .filter((item) => item.status === "AVAILABLE")
      .sort(
        (a, b) =>
          b.weightedContribution -
          a.weightedContribution,
      )
      .slice(0, 5)
      .map((item) => ({
        key: item.key,
        rawValue: item.rawValue,
        normalizedValue:
          item.normalizedValue,
        contribution:
          item.weightedContribution,
      })),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Match Scoring testi başarısız:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });