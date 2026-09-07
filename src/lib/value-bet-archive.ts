import { createHash } from "node:crypto";

import { ACTIVE_COMPETITION_API_IDS } from "@/config/competitions";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { settleMarketSelection } from "@/lib/market-settlement";
import { prisma } from "@/lib/prisma";
import { runSmartCouponArchiveAutomation, type SmartCouponArchiveSummary } from "@/lib/smart-coupon-archive";
import { buildSmartCouponCenter } from "@/lib/smart-coupon-engine";
import {
  saveValueBetDashboardSnapshot,
  type ValueBetDashboardRow,
} from "@/lib/value-bet-dashboard-snapshot";
import { calculateValueBets } from "@/modules/value-bet-engine";

const VALUE_POLICY_VERSION = "value-policy-v2.0";
const MAXIMUM_MATCHES = 100;
const MAXIMUM_SETTLED_ROWS = 2000;

export type ValueBetPublicationSummary = {
  matchesEvaluated: number;
  comparisons: number;
  publishableFound: number;
  published: number;
  duplicatesSkipped: number;
  calculationFailures: number;
};

export type ValueBetSettlementSummary = {
  pendingEvaluated: number;
  won: number;
  lost: number;
  voided: number;
  unsupportedMarkets: number;
  incompleteScores: number;
  rescheduled: number;
};

export type ValueBetArchiveAutomationSummary = {
  publication: ValueBetPublicationSummary;
  settlement: ValueBetSettlementSummary;
  dashboard: {
    upcoming: number;
    settled: number;
    generatedAt: Date;
  };
  coupons: SmartCouponArchiveSummary;
  warnings: string[];
};

function createFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toDashboardRow(row: {
  id: number;
  matchId: number;
  leagueApiId: number;
  leagueName: string;
  kickoffAt: Date;
  homeTeam: string;
  awayTeam: string;
  marketKey: string;
  market: string;
  selection: string;
  modelProbability: number;
  fairOdds: number | null;
  bestOdds: number;
  medianOdds: number;
  marketProbability: number;
  marketEdge: number;
  expectedValue: number;
  valueScore: number;
  recommendedStakePercentage: number;
  bookmakerName: string;
  bookmakerCount: number;
  valueLevel: string;
  sourceUpdatedAt: Date;
  capturedAt: Date;
  result: string;
  profitUnits: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  publishedAt: Date;
  settledAt: Date | null;
}): ValueBetDashboardRow {
  const status = ["PENDING", "WON", "LOST", "VOID"].includes(row.result)
    ? (row.result as ValueBetDashboardRow["result"])
    : "VOID";

  return { ...row, result: status };
}

export async function publishUpcomingValueBets(
  now = new Date(),
): Promise<{ summary: ValueBetPublicationSummary; warnings: string[] }> {
  const matches = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      kickoffAt: { gt: now },
      season: {
        year: ACTIVE_SEASON_YEAR,
        league: {
          apiId: { in: [...ACTIVE_COMPETITION_API_IDS] },
        },
      },
      oddsSnapshots: { some: {} },
    },
    orderBy: { kickoffAt: "asc" },
    take: MAXIMUM_MATCHES,
    select: {
      id: true,
      season: { select: { league: { select: { apiId: true } } } },
    },
  });

  const summary: ValueBetPublicationSummary = {
    matchesEvaluated: 0,
    comparisons: 0,
    publishableFound: 0,
    published: 0,
    duplicatesSkipped: 0,
    calculationFailures: 0,
  };
  const warnings: string[] = [];

  for (const match of matches) {
    summary.matchesEvaluated += 1;

    try {
      const result = await calculateValueBets(match.id, { minimumOdds: 1.25 });
      summary.comparisons += result.comparisonCount;
      summary.publishableFound += result.publishableValueBetCount;

      const rows = result.publishableValueBets.map((valueBet) => {
        const bestQuote = valueBet.validQuotes.find(
          (quote) => quote.bookmakerId === valueBet.bestBookmakerId,
        ) ?? valueBet.validQuotes[0];
        const modelVersion = [
          result.model.predictionVersion,
          result.model.marketVersion,
          result.model.ratingVersion,
          VALUE_POLICY_VERSION,
        ].join("+");
        const fingerprint = createFingerprint({
          matchId: match.id,
          marketKey: valueBet.marketKey,
          modelVersion,
          modelProbability: valueBet.modelProbability,
          bestOdds: valueBet.bestOdds,
          bookmakerId: valueBet.bestBookmakerId,
          sourceUpdatedAt: bestQuote.sourceUpdatedAt.toISOString(),
        });

        return {
          matchId: match.id,
          bookmakerId: valueBet.bestBookmakerId,
          leagueApiId: match.season.league.apiId,
          leagueName: result.match.leagueName,
          kickoffAt: result.match.kickoffAt,
          homeTeam: result.match.homeTeam,
          awayTeam: result.match.awayTeam,
          marketKey: valueBet.marketKey,
          market: valueBet.market,
          selection: valueBet.selection,
          modelProbability: valueBet.modelProbability,
          fairOdds: valueBet.modelFairOdds,
          bestOdds: valueBet.bestOdds,
          medianOdds: valueBet.medianOdds,
          marketProbability: valueBet.medianMarketProbability,
          marketEdge: valueBet.marketEdge,
          expectedValue: valueBet.expectedValue,
          valueScore: valueBet.valueScore,
          recommendedStakePercentage: valueBet.recommendedStakePercentage,
          bookmakerName: valueBet.bestBookmakerName,
          bookmakerCount: valueBet.validBookmakerCount,
          valueLevel: valueBet.valueLevel,
          publishStatus: valueBet.publishStatus,
          sourceUpdatedAt: bestQuote.sourceUpdatedAt,
          capturedAt: bestQuote.capturedAt,
          result: "PENDING",
          modelName: "Value Bet Engine V2",
          modelVersion,
          publicationFingerprint: fingerprint,
          publishedAt: now,
        };
      });

      if (rows.length > 0) {
        const created = await prisma.valueBetHistory.createMany({
          data: rows,
          skipDuplicates: true,
        });
        summary.published += created.count;
        summary.duplicatesSkipped += rows.length - created.count;
      }
    } catch (error: unknown) {
      summary.calculationFailures += 1;
      warnings.push(
        `Value Bet calculation failed for match ${match.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return { summary, warnings };
}

export async function settleArchivedValueBets(
  now = new Date(),
): Promise<ValueBetSettlementSummary> {
  const pending = await prisma.valueBetHistory.findMany({
    where: {
      result: "PENDING",
      match: {
        status: { in: ["FINISHED", "POSTPONED", "CANCELLED"] },
        season: {
          year: ACTIVE_SEASON_YEAR,
        },
      },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      marketKey: true,
      bestOdds: true,
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
  });

  const summary: ValueBetSettlementSummary = {
    pendingEvaluated: pending.length,
    won: 0,
    lost: 0,
    voided: 0,
    unsupportedMarkets: 0,
    incompleteScores: 0,
    rescheduled: 0,
  };

  for (const valueBet of pending) {
    let result: "WON" | "LOST" | "VOID";
    let actualHomeScore: number | null = null;
    let actualAwayScore: number | null = null;

    const kickoffChanged = Math.abs(
      valueBet.kickoffAt.getTime() - valueBet.match.kickoffAt.getTime(),
    ) > 15 * 60 * 1000;

    if (kickoffChanged) {
      result = "VOID";
      summary.rescheduled += 1;
    } else if (["POSTPONED", "CANCELLED"].includes(valueBet.match.status)) {
      result = "VOID";
    } else if (
      valueBet.match.homeScore === null ||
      valueBet.match.awayScore === null
    ) {
      summary.incompleteScores += 1;
      continue;
    } else {
      const finalHomeScore = valueBet.match.homeScore;
      const finalAwayScore = valueBet.match.awayScore;

      actualHomeScore = finalHomeScore;
      actualAwayScore = finalAwayScore;
      const settlement = settleMarketSelection({
        marketKey: valueBet.marketKey,
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
      });
      result = settlement.result;
      if (!settlement.supported) summary.unsupportedMarkets += 1;
    }

    const profitUnits =
      result === "WON" ? valueBet.bestOdds - 1 : result === "LOST" ? -1 : 0;

    await prisma.valueBetHistory.update({
      where: { id: valueBet.id },
      data: {
        actualHomeScore,
        actualAwayScore,
        result,
        profitUnits,
        settledAt: now,
      },
    });

    if (result === "WON") summary.won += 1;
    else if (result === "LOST") summary.lost += 1;
    else summary.voided += 1;
  }

  return summary;
}

export async function runValueBetArchiveAutomation(): Promise<ValueBetArchiveAutomationSummary> {
  const now = new Date();
  const settlement = await settleArchivedValueBets(now);
  const publicationResult = await publishUpcomingValueBets(now);

  const [upcomingRows, settledRows] = await Promise.all([
    prisma.valueBetHistory.findMany({
      where: {
        result: "PENDING",
        kickoffAt: { gt: new Date() },
        match: {
          season: {
            year: ACTIVE_SEASON_YEAR,
          },
        },
      },
      orderBy: [{ valueScore: "desc" }, { kickoffAt: "asc" }],
      take: MAXIMUM_MATCHES,
    }),
    prisma.valueBetHistory.findMany({
      where: {
        result: { in: ["WON", "LOST", "VOID"] },
        match: {
          season: {
            year: ACTIVE_SEASON_YEAR,
          },
        },
      },
      orderBy: { settledAt: "desc" },
      take: MAXIMUM_SETTLED_ROWS,
    }),
  ]);

  const upcoming = upcomingRows.map(toDashboardRow);
  const settled = settledRows.map(toDashboardRow);
  const dashboard = await saveValueBetDashboardSnapshot({
    upcoming,
    settled,
    generatedAt: now,
  });
  const couponCenter = buildSmartCouponCenter(upcoming, { now, historicalRows: settled });
  const coupons = await runSmartCouponArchiveAutomation(couponCenter.coupons, now);

  return {
    publication: publicationResult.summary,
    settlement,
    dashboard: {
      upcoming: dashboard.upcoming,
      settled: dashboard.settled,
      generatedAt: dashboard.generatedAt,
    },
    coupons,
    warnings: publicationResult.warnings,
  };
}
