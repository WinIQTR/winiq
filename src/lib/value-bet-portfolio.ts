import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";
import {
  applyExposureCaps,
  DEFAULT_DECISION_ENGINE_CONFIG,
  isMarketEnabled,
} from "@/modules/decision-engine";

const ISTANBUL_TIME_ZONE = "Europe/Istanbul";

export const DEFAULT_MAXIMUM_DAILY_RISK_PERCENTAGE = 6;
export const DEFAULT_MINIMUM_PORTFOLIO_EXPECTED_VALUE = 5;
export const DEFAULT_MINIMUM_PORTFOLIO_EDGE = 3;

export type PortfolioStatus = "PRIMARY" | "WATCH";

export type PortfolioSelection = {
  row: ValueBetDashboardRow;
  status: PortfolioStatus;
  portfolioStakePercentage: number;
  dateKey: string;
};

export type PortfolioAlternative = {
  row: ValueBetDashboardRow;
  primaryMarketKey: string;
  dateKey: string;
};

export type DailyPortfolioSummary = {
  dateKey: string;
  primaryCount: number;
  watchCount: number;
  allocatedRiskPercentage: number;
};

export type ValueBetPortfolio = {
  selections: PortfolioSelection[];
  primarySelections: PortfolioSelection[];
  watchSelections: PortfolioSelection[];
  alternatives: PortfolioAlternative[];
  dailySummaries: DailyPortfolioSummary[];
  maximumDailyAllocatedRiskPercentage: number;
};

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toIstanbulDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ISTANBUL_TIME_ZONE,
  }).formatToParts(value);
  const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function compareRows(
  first: ValueBetDashboardRow,
  second: ValueBetDashboardRow,
): number {
  return (
    second.valueScore - first.valueScore ||
    second.expectedValue - first.expectedValue ||
    second.marketEdge - first.marketEdge ||
    second.modelProbability - first.modelProbability ||
    first.marketKey.localeCompare(second.marketKey)
  );
}

export function buildValueBetPortfolio(
  rows: readonly ValueBetDashboardRow[],
  options?: {
    maximumDailyRiskPercentage?: number;
    minimumExpectedValue?: number;
    minimumMarketEdge?: number;
  },
): ValueBetPortfolio {
  const maximumDailyRiskPercentage = Math.max(
    0,
    options?.maximumDailyRiskPercentage ??
      DEFAULT_MAXIMUM_DAILY_RISK_PERCENTAGE,
  );
  const minimumExpectedValue =
    options?.minimumExpectedValue ??
    DEFAULT_MINIMUM_PORTFOLIO_EXPECTED_VALUE;
  const minimumMarketEdge =
    options?.minimumMarketEdge ?? DEFAULT_MINIMUM_PORTFOLIO_EDGE;

  const enabledRows = rows.filter((row) => isMarketEnabled(row.marketKey));
  const matchGroups = new Map<number, ValueBetDashboardRow[]>();

  for (const row of enabledRows) {
    const group = matchGroups.get(row.matchId) ?? [];
    group.push(row);
    matchGroups.set(row.matchId, group);
  }

  const initialSelections: PortfolioSelection[] = [];
  const alternatives: PortfolioAlternative[] = [];

  for (const group of matchGroups.values()) {
    const sorted = [...group].sort(compareRows);
    const strongest = sorted[0];
    if (!strongest) continue;

    const dateKey = toIstanbulDateKey(strongest.kickoffAt);
    const status: PortfolioStatus =
      strongest.expectedValue >= minimumExpectedValue &&
      strongest.marketEdge >= minimumMarketEdge
        ? "PRIMARY"
        : "WATCH";

    initialSelections.push({
      row: strongest,
      status,
      portfolioStakePercentage: 0,
      dateKey,
    });

    for (const alternative of sorted.slice(1)) {
      alternatives.push({
        row: alternative,
        primaryMarketKey: strongest.marketKey,
        dateKey,
      });
    }
  }

  initialSelections.sort((first, second) =>
    first.row.kickoffAt.getTime() - second.row.kickoffAt.getTime() ||
    compareRows(first.row, second.row),
  );
  alternatives.sort((first, second) =>
    first.row.kickoffAt.getTime() - second.row.kickoffAt.getTime() ||
    compareRows(first.row, second.row),
  );

  const selectionsByDate = new Map<string, PortfolioSelection[]>();
  for (const selection of initialSelections) {
    const group = selectionsByDate.get(selection.dateKey) ?? [];
    group.push(selection);
    selectionsByDate.set(selection.dateKey, group);
  }

  const selections: PortfolioSelection[] = [];
  const dailySummaries: DailyPortfolioSummary[] = [];

  for (const [dateKey, dailySelections] of selectionsByDate) {
    const primary = dailySelections.filter(
      (selection) => selection.status === "PRIMARY",
    );

    const exposure = applyExposureCaps(
      primary.map((selection) => ({
        id: `${selection.row.matchId}:${selection.row.marketKey}`,
        matchId: selection.row.matchId,
        leagueKey: String(selection.row.leagueApiId),
        kickoffAt: selection.row.kickoffAt,
        stakeFraction: Math.min(
          DEFAULT_DECISION_ENGINE_CONFIG.exposure
            .maximumHypotheticalFractionPerSelection,
          Math.max(0, selection.row.recommendedStakePercentage) / 100,
        ),
        score: selection.row.valueScore,
        correlationGroup: String(selection.row.leagueApiId),
      })),
    );
    const acceptedPrimaryIds = new Set(
      exposure.filter((item) => item.accepted).map((item) => item.id),
    );

    const gatedDaily = dailySelections.map((selection) => {
      if (selection.status !== "PRIMARY") return selection;
      const id = `${selection.row.matchId}:${selection.row.marketKey}`;
      if (acceptedPrimaryIds.has(id)) return selection;
      return { ...selection, status: "WATCH" as const };
    });

    const gatedPrimary = gatedDaily.filter(
      (selection) => selection.status === "PRIMARY",
    );
    const requestedRisk = gatedPrimary.reduce(
      (total, selection) =>
        total + Math.max(0, selection.row.recommendedStakePercentage),
      0,
    );
    const scale =
      requestedRisk > maximumDailyRiskPercentage && requestedRisk > 0
        ? maximumDailyRiskPercentage / requestedRisk
        : 1;

    let remainingRisk = maximumDailyRiskPercentage;
    const allocated = gatedDaily.map((selection) => {
      const requestedAllocation = selection.status === "PRIMARY"
        ? round(
            Math.max(0, selection.row.recommendedStakePercentage) * scale,
            2,
          )
        : 0;
      const portfolioStakePercentage = round(
        Math.min(requestedAllocation, Math.max(0, remainingRisk)),
        2,
      );
      remainingRisk = round(remainingRisk - portfolioStakePercentage, 2);

      return { ...selection, portfolioStakePercentage };
    });
    const allocatedRiskPercentage = round(
      allocated.reduce(
        (total, selection) =>
          total + selection.portfolioStakePercentage,
        0,
      ),
      2,
    );

    selections.push(...allocated);
    dailySummaries.push({
      dateKey,
      primaryCount: gatedPrimary.length,
      watchCount: gatedDaily.length - gatedPrimary.length,
      allocatedRiskPercentage,
    });
  }

  dailySummaries.sort((first, second) =>
    first.dateKey.localeCompare(second.dateKey),
  );

  return {
    selections,
    primarySelections: selections.filter(
      (selection) => selection.status === "PRIMARY",
    ),
    watchSelections: selections.filter(
      (selection) => selection.status === "WATCH",
    ),
    alternatives,
    dailySummaries,
    maximumDailyAllocatedRiskPercentage: round(
      Math.max(
        0,
        ...dailySummaries.map(
          (summary) => summary.allocatedRiskPercentage,
        ),
      ),
      2,
    ),
  };
}
