import { createHash } from "node:crypto";

import {
  loadDashboardPredictions,
  type ProductionDashboardPrediction,
} from "@/lib/prediction-dashboard";

import {
  loadDashboardPredictionSnapshot,
  mergeDashboardPredictionHistory,
  saveDashboardPredictionSnapshot,
  type DashboardSnapshotWriteResult,
} from "@/lib/prediction-dashboard-snapshot";

import {
  settleMarketSelection,
  type SettlementResult,
} from "@/lib/market-settlement";

import { prisma } from "@/lib/prisma";

const MAXIMUM_PUBLISHABLE_MATCHES = 300;

export type PredictionPublicationSummary = {
  matchesEvaluated: number;
  picksConsidered: number;
  published: number;
  duplicatesSkipped: number;
  kickoffSkipped: number;
};

export type PredictionSettlementSummary = {
  pendingEvaluated: number;
  won: number;
  lost: number;
  voided: number;
  unsupportedMarkets: number;
  incompleteScores: number;
  rescheduled: number;
};

export type PredictionArchiveAutomationSummary = {
  publication: PredictionPublicationSummary;
  settlement: PredictionSettlementSummary;
  dashboardSnapshot: DashboardSnapshotWriteResult;
};

type ArchivedSettlementRow = {
  matchId: number;
  result: string;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
};

function normalizeDashboardSettlement(
  value: string,
): "PENDING" | "WON" | "LOST" | "VOID" {
  switch (value.trim().toUpperCase()) {
    case "WON":
      return "WON";

    case "LOST":
      return "LOST";

    case "VOID":
      return "VOID";

    default:
      return "PENDING";
  }
}

function applySettlementRows(
  predictions: readonly ProductionDashboardPrediction[],
  rows: readonly ArchivedSettlementRow[],
): ProductionDashboardPrediction[] {
  const firstRankedSettlementByMatch =
    new Map<number, ArchivedSettlementRow>();

  for (const row of rows) {
    if (!firstRankedSettlementByMatch.has(row.matchId)) {
      firstRankedSettlementByMatch.set(row.matchId, row);
    }
  }

  return predictions.map((prediction) => {
    const settlement =
      firstRankedSettlementByMatch.get(prediction.matchId);

    if (!settlement) {
      return prediction;
    }

    return {
      ...prediction,
      settlementStatus:
        normalizeDashboardSettlement(settlement.result),
      finalHomeScore:
        settlement.actualHomeScore,
      finalAwayScore:
        settlement.actualAwayScore,
    };
  });
}

export async function attachArchivedPredictionResults(
  predictions: readonly ProductionDashboardPrediction[],
): Promise<ProductionDashboardPrediction[]> {
  const matchIds = [
    ...new Set(
      predictions.map((prediction) => prediction.matchId),
    ),
  ];

  if (matchIds.length === 0) {
    return [];
  }

  const rows = await prisma.smartPickHistory.findMany({
    where: {
      matchId: {
        in: matchIds,
      },
      rank: 1,
    },
    select: {
      matchId: true,
      result: true,
      actualHomeScore: true,
      actualAwayScore: true,
    },
    orderBy: [
      {
        publishedAt: "asc",
      },
      {
        id: "asc",
      },
    ],
  });

  return applySettlementRows(predictions, rows);
}

function createModelVersion(
  prediction: ProductionDashboardPrediction,
): string {
  return [
    prediction.productionModelName,
    prediction.topPicksModelVersion,
    prediction.selectionPolicyVersion,
    `kickoff-${prediction.kickoffAt.toISOString()}`,
  ].join("+");
}

function createPublicationFingerprint(options: {
  matchId: number;
  marketKey: string;
  selection: string;
  probability: number;
  reliabilityScore: number;
  pickScore: number;
  modelVersion: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify(options))
    .digest("hex");
}

export async function publishUpcomingPredictions(
  now = new Date(),
): Promise<PredictionPublicationSummary> {
  const predictions =
    await loadDashboardPredictions(
      MAXIMUM_PUBLISHABLE_MATCHES,
    );

  let picksConsidered = 0;
  let published = 0;
  let duplicatesSkipped = 0;
  let kickoffSkipped = 0;

  for (const prediction of predictions) {
    if (
      prediction.kickoffAt.getTime() <=
      now.getTime()
    ) {
      kickoffSkipped +=
        prediction.topPicks.length;

      continue;
    }

    const modelVersion =
      createModelVersion(prediction);

    const rows = prediction.topPicks.map(
      (pick) => {
        picksConsidered += 1;

        return {
          matchId: prediction.matchId,
          leagueApiId: prediction.leagueApiId,
          leagueName: prediction.leagueName,
          kickoffAt: prediction.kickoffAt,
          homeTeam: prediction.homeTeam,
          awayTeam: prediction.awayTeam,
          marketKey: pick.key,
          category: pick.category,
          market: pick.market,
          selection: pick.selection,
          probability: pick.probability,
          fairOdds: pick.fairOdds,
          marketOdds: null,
          reliabilityScore: pick.reliabilityScore,
          pickScore: pick.pickScore,
          dataQualityScore: prediction.dataQualityScore,
          tier: pick.tier,
          historicalHitRate: pick.historicalHitRate,
          historicalSamples: pick.historicalSamples,
          thresholdHitRate: pick.thresholdHitRate,
          thresholdSamples: pick.thresholdSamples,
          result: "PENDING" as const,
          rank: pick.rank,
          modelName: prediction.topPicksModelName,
          modelVersion,
          publishedAt: now,
          publicationFingerprint:
            createPublicationFingerprint({
              matchId: prediction.matchId,
              marketKey: pick.key,
              selection: pick.selection,
              probability: pick.probability,
              reliabilityScore: pick.reliabilityScore,
              pickScore: pick.pickScore,
              modelVersion,
            }),
        };
      },
    );

    if (rows.length === 0) {
      continue;
    }

    const result =
      await prisma.smartPickHistory.createMany({
        data: rows,
        skipDuplicates: true,
      });

    published += result.count;
    duplicatesSkipped +=
      rows.length - result.count;
  }

  return {
    matchesEvaluated: predictions.length,
    picksConsidered,
    published,
    duplicatesSkipped,
    kickoffSkipped,
  };
}

export async function settleArchivedPredictions(
  now = new Date(),
): Promise<PredictionSettlementSummary> {
  const pending =
    await prisma.smartPickHistory.findMany({
      where: {
        result: "PENDING",
        match: {
          status: {
            in: [
              "FINISHED",
              "POSTPONED",
              "CANCELLED",
            ],
          },
        },
      },
      select: {
        id: true,
        marketKey: true,
        kickoffAt: true,
        match: {
          select: {
            status: true,
            kickoffAt: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });

  let won = 0;
  let lost = 0;
  let voided = 0;
  let unsupportedMarkets = 0;
  let incompleteScores = 0;
  let rescheduled = 0;

  for (const prediction of pending) {
    let result: SettlementResult;
    let actualHomeScore: number | null = null;
    let actualAwayScore: number | null = null;

    const kickoffChanged =
      Math.abs(
        prediction.kickoffAt.getTime() -
        prediction.match.kickoffAt.getTime(),
      ) >
      15 * 60 * 1000;

    if (kickoffChanged) {
      result = "VOID";
      rescheduled += 1;
    } else if (
      prediction.match.status === "POSTPONED" ||
      prediction.match.status === "CANCELLED"
    ) {
      result = "VOID";
    } else if (
      prediction.match.homeScore === null ||
      prediction.match.awayScore === null
    ) {
      incompleteScores += 1;
      continue;
    } else {
      actualHomeScore =
        prediction.match.homeScore;
      actualAwayScore =
        prediction.match.awayScore;

      const settlement =
        settleMarketSelection({
          marketKey: prediction.marketKey,
          homeScore: actualHomeScore,
          awayScore: actualAwayScore,
        });

      result = settlement.result;

      if (!settlement.supported) {
        unsupportedMarkets += 1;
      }
    }

    await prisma.smartPickHistory.update({
      where: {
        id: prediction.id,
      },
      data: {
        actualHomeScore,
        actualAwayScore,
        result,
        settledAt: now,
      },
    });

    if (result === "WON") {
      won += 1;
    } else if (result === "LOST") {
      lost += 1;
    } else {
      voided += 1;
    }
  }

  return {
    pendingEvaluated: pending.length,
    won,
    lost,
    voided,
    unsupportedMarkets,
    incompleteScores,
    rescheduled,
  };
}

export async function runPredictionArchiveAutomation(): Promise<
  PredictionArchiveAutomationSummary
> {
  const settlement =
    await settleArchivedPredictions();

  const publication =
    await publishUpcomingPredictions();

  // Publication has already populated the in-process prediction cache.
  // Reusing it here is fast and keeps web requests read-only.
  const dashboardPredictions =
    await loadDashboardPredictions(
      MAXIMUM_PUBLISHABLE_MATCHES,
    );

  const archivedDashboardPredictions =
    await loadDashboardPredictionSnapshot(
      20_000,
    );

  const completeDashboardHistory =
    mergeDashboardPredictionHistory(
      archivedDashboardPredictions,
      dashboardPredictions,
    );

  const settledDashboardHistory =
    await attachArchivedPredictionResults(
      completeDashboardHistory,
    );

  const dashboardSnapshot =
    await saveDashboardPredictionSnapshot(
      settledDashboardHistory,
      new Date(),
      {
        mergeExisting: false,
      },
    );

  return {
    publication,
    settlement,
    dashboardSnapshot,
  };
}
