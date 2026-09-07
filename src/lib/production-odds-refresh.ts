import { ACTIVE_COMPETITION_API_IDS } from "@/config/competitions";
import { prisma } from "@/lib/prisma";
import { importFixtureOdds } from "@/modules/bookmaker-odds-engine";

const DEFAULT_MATCH_LIMIT = 15;
const MAXIMUM_MATCH_LIMIT = 100;
const DEFAULT_REQUEST_DELAY_MS = 350;
const DEFAULT_ODDS_DAYS_AHEAD = 30;
const MAXIMUM_ODDS_DAYS_AHEAD = 60;

export type ProductionOddsRefreshSummary = {
  enabled: boolean;
  candidates: number;
  attempted: number;
  imported: number;
  noData: number;
  failed: number;
  deferred: number;
  bookmakers: number;
  snapshots: number;
  markets: number;
  selections: number;
  warnings: string[];
};

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;

  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
}

function isEnabled(value: string | undefined): boolean {
  if (!value) return true;

  return !["0", "false", "off", "no"].includes(
    value.trim().toLowerCase(),
  );
}

function resolveRefreshIntervalMinutes(minutesUntilKickoff: number): number {
  if (minutesUntilKickoff <= 120) return 30;
  if (minutesUntilKickoff <= 360) return 60;
  if (minutesUntilKickoff <= 1440) return 180;
  if (minutesUntilKickoff <= 4320) return 360;
  return 360;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function refreshUpcomingBookmakerOdds(options: {
  apiKey: string;
  baseUrl: string;
  now?: Date;
}): Promise<ProductionOddsRefreshSummary> {
  const now = options.now ?? new Date();
  const enabled = isEnabled(process.env.ENABLE_BOOKMAKER_ODDS);
  const warnings: string[] = [];

  const emptySummary: ProductionOddsRefreshSummary = {
    enabled,
    candidates: 0,
    attempted: 0,
    imported: 0,
    noData: 0,
    failed: 0,
    deferred: 0,
    bookmakers: 0,
    snapshots: 0,
    markets: 0,
    selections: 0,
    warnings,
  };

  if (!enabled) {
    warnings.push("Bookmaker odds refresh is disabled by ENABLE_BOOKMAKER_ODDS.");
    return emptySummary;
  }

  const matchLimit = parsePositiveInteger(
    process.env.ODDS_MATCH_LIMIT,
    DEFAULT_MATCH_LIMIT,
    MAXIMUM_MATCH_LIMIT,
  );
  const delayMs = parsePositiveInteger(
    process.env.ODDS_REQUEST_DELAY_MS,
    DEFAULT_REQUEST_DELAY_MS,
    10_000,
  );
  const daysAhead = parsePositiveInteger(
    process.env.ODDS_DAYS_AHEAD ?? process.env.PREDICTION_DAYS,
    DEFAULT_ODDS_DAYS_AHEAD,
    MAXIMUM_ODDS_DAYS_AHEAD,
  );
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + daysAhead);

  const matches = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      kickoffAt: {
        gt: now,
        lte: windowEnd,
      },
      season: {
        league: {
          apiId: { in: [...ACTIVE_COMPETITION_API_IDS] },
        },
      },
    },
    orderBy: { kickoffAt: "asc" },
    select: {
      id: true,
      kickoffAt: true,
      oddsSnapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
        select: { capturedAt: true },
      },
    },
  });

  const dueMatches = matches.filter((match) => {
    const latestCapture = match.oddsSnapshots[0]?.capturedAt;
    if (!latestCapture) return true;

    const minutesUntilKickoff = Math.max(
      0,
      (match.kickoffAt.getTime() - now.getTime()) / 60_000,
    );
    const ageMinutes = Math.max(
      0,
      (now.getTime() - latestCapture.getTime()) / 60_000,
    );

    return ageMinutes >= resolveRefreshIntervalMinutes(minutesUntilKickoff);
  });

  const selectedMatches = dueMatches.slice(0, matchLimit);
  const summary: ProductionOddsRefreshSummary = {
    ...emptySummary,
    candidates: dueMatches.length,
    deferred: Math.max(0, dueMatches.length - selectedMatches.length),
  };

  for (const [index, match] of selectedMatches.entries()) {
    summary.attempted += 1;

    try {
      const result = await importFixtureOdds({
        matchId: match.id,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
      });

      summary.bookmakers += result.bookmakerCount;
      summary.snapshots += result.snapshotCount;
      summary.markets += result.marketCount;
      summary.selections += result.selectionCount;

      if (result.selectionCount > 0) {
        summary.imported += 1;
      } else {
        summary.noData += 1;
      }
    } catch (error: unknown) {
      summary.failed += 1;
      warnings.push(
        `Odds import failed for match ${match.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (index < selectedMatches.length - 1) {
      await wait(delayMs);
    }
  }

  return summary;
}
