import "dotenv/config";

import { apiFootballRequest } from "@/lib/api-football/client";
import {
  mapApiFootballFixtureStatus,
  resolveFixtureScores,
} from "@/lib/api-football/fixture-status";
import { prisma } from "@/lib/prisma";

type FixtureRow = {
  fixture: {
    id: number;
    referee?: string | null;
    status?: { short?: string | null; elapsed?: number | null };
    venue?: { name?: string | null; city?: string | null };
  };
  goals?: { home?: number | null; away?: number | null };
  score?: {
    fulltime?: { home?: number | null; away?: number | null };
    halftime?: { home?: number | null; away?: number | null };
  };
};

type LocalMatch = {
  id: number;
  apiId: number;
  referee: string | null;
  venueName: string | null;
  venueCity?: string | null;
  kickoffAt?: Date | null;
  status?: string | null;
};

/** Free plan rejects `ids=`; keep page loads within a small request budget. */
const DEFAULT_MAX_FIXTURES = 8;

/** Free plan allows ~10 req/min; space single-id calls when backfilling. */
const DEFAULT_SINGLE_ID_GAP_MS = 0;

export type SyncMissingFixtureRefereesResult = {
  updated: number;
  checked: number;
  statusUpdated: number;
};

function istanbulDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(value);
}

function addIstanbulDay(dateKey: string, deltaDays: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return utc.toISOString().slice(0, 10);
}

function isNearTodayIstanbul(dateKey: string, now = new Date()): boolean {
  const today = istanbulDateKey(now);
  return (
    dateKey === today ||
    dateKey === addIstanbulDay(today, -1) ||
    dateKey === addIstanbulDay(today, 1)
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyFixtureRowToData(
  match: LocalMatch,
  row: FixtureRow,
): { data: Record<string, unknown>; gotReferee: boolean; statusChanged: boolean } {
  const referee = row.fixture.referee?.trim() || null;
  const venueName = row.fixture.venue?.name?.trim() || null;
  const venueCity = row.fixture.venue?.city?.trim() || null;
  const statusShort = row.fixture.status?.short?.trim() || null;
  const status = mapApiFootballFixtureStatus(statusShort);
  const { homeScore, awayScore } = resolveFixtureScores({
    goalsHome: row.goals?.home,
    goalsAway: row.goals?.away,
    fulltimeHome: row.score?.fulltime?.home,
    fulltimeAway: row.score?.fulltime?.away,
  });
  const halfTimeHomeScore =
    typeof row.score?.halftime?.home === "number"
      ? row.score.halftime.home
      : undefined;
  const halfTimeAwayScore =
    typeof row.score?.halftime?.away === "number"
      ? row.score.halftime.away
      : undefined;
  const elapsedMinutes =
    typeof row.fixture.status?.elapsed === "number"
      ? row.fixture.status.elapsed
      : undefined;

  const data: Record<string, unknown> = {};
  if (referee) data.referee = referee;
  if (!match.venueName && venueName) data.venueName = venueName;
  if (!match.venueCity && venueCity) data.venueCity = venueCity;
  if (statusShort) data.statusShort = statusShort;
  const statusChanged = Boolean(status && status !== match.status);
  if (statusChanged) data.status = status;
  if (homeScore !== null) data.homeScore = homeScore;
  if (awayScore !== null) data.awayScore = awayScore;
  if (halfTimeHomeScore !== undefined) data.halfTimeHomeScore = halfTimeHomeScore;
  if (halfTimeAwayScore !== undefined) data.halfTimeAwayScore = halfTimeAwayScore;
  if (elapsedMinutes !== undefined) data.elapsedMinutes = elapsedMinutes;

  return { data, gotReferee: Boolean(referee), statusChanged };
}

/**
 * Pulls referee / venue / status / scores from API-Football for matches that
 * still lack a referee (or venue city).
 *
 * Free-plan notes:
 * - `ids=` is blocked → never use it
 * - `date=` only works for a narrow near-today window
 * - historical fixtures still answer to single `id=`
 */
export async function syncMissingFixtureReferees(
  matches: LocalMatch[],
  options?: {
    maxFixtures?: number;
    maxBatches?: number;
    singleIdGapMs?: number;
  },
): Promise<SyncMissingFixtureRefereesResult> {
  const missing = matches
    .filter((match) => !match.referee?.trim() || !match.venueCity?.trim())
    .sort((left, right) => {
      const leftKick = left.kickoffAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const rightKick = right.kickoffAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const now = Date.now();
      const leftPast = leftKick <= now ? 0 : 1;
      const rightPast = rightKick <= now ? 0 : 1;
      if (leftPast !== rightPast) return leftPast - rightPast;
      return leftKick - rightKick;
    });

  if (!missing.length) {
    return { updated: 0, checked: 0, statusUpdated: 0 };
  }

  const legacyBudget =
    typeof options?.maxBatches === "number"
      ? Math.max(1, options.maxBatches) * 20
      : null;
  const maxFixtures = Math.max(
    1,
    options?.maxFixtures ?? legacyBudget ?? DEFAULT_MAX_FIXTURES,
  );
  const singleIdGapMs = Math.max(
    0,
    options?.singleIdGapMs ?? DEFAULT_SINGLE_ID_GAP_MS,
  );

  let updated = 0;
  let checked = 0;
  let statusUpdated = 0;
  const pending = new Map(missing.map((match) => [match.apiId, match]));
  const byApiId = new Map(missing.map((match) => [match.apiId, match]));

  // 1) Near-today calendar days: one request can fill many fixtures.
  const nearDates = [
    ...new Set(
      missing
        .filter((match) => match.kickoffAt)
        .map((match) => istanbulDateKey(match.kickoffAt!))
        .filter((dateKey) => isNearTodayIstanbul(dateKey)),
    ),
  ];

  for (const date of nearDates) {
    if (updated >= maxFixtures && checked >= maxFixtures) break;
    try {
      const response = await apiFootballRequest<FixtureRow[]>(
        "fixtures",
        { date, timezone: "Europe/Istanbul" },
        { bypassRateLimit: true },
      );
      for (const row of response.response ?? []) {
        const local = byApiId.get(row.fixture.id);
        if (!local || !pending.has(local.apiId)) continue;
        if (!local.referee?.trim() || !local.venueCity?.trim()) {
          checked += 1;
        }
        const { data, gotReferee, statusChanged } = applyFixtureRowToData(
          local,
          row,
        );
        if (!Object.keys(data).length) continue;
        await prisma.match.update({ where: { id: local.id }, data });
        if (gotReferee) local.referee = String(data.referee);
        if (data.venueCity) local.venueCity = String(data.venueCity);
        if (statusChanged) {
          local.status = String(data.status);
          statusUpdated += 1;
        }
        updated += 1;
        pending.delete(local.apiId);
      }
    } catch (error) {
      // Outside free date window — fall through to single-id.
      console.warn(
        "[syncMissingFixtureReferees] date fetch skipped:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // 2) Remaining gaps: Free-plan safe single `id=`.
  for (const match of [...pending.values()].slice(0, maxFixtures)) {
    try {
      if (singleIdGapMs > 0 && checked > 0) {
        await sleep(singleIdGapMs);
      }
      const response = await apiFootballRequest<FixtureRow[]>(
        "fixtures",
        { id: match.apiId },
        { bypassRateLimit: true },
      );
      checked += 1;

      const row = (response.response ?? []).find(
        (item) => item.fixture.id === match.apiId,
      );
      if (!row) continue;

      const { data, gotReferee, statusChanged } = applyFixtureRowToData(
        match,
        row,
      );
      if (!Object.keys(data).length) continue;

      await prisma.match.update({ where: { id: match.id }, data });
      if (gotReferee) match.referee = String(data.referee);
      if (data.venueCity) match.venueCity = String(data.venueCity);
      if (statusChanged) {
        match.status = String(data.status);
        statusUpdated += 1;
      }
      updated += 1;
      pending.delete(match.apiId);
    } catch (error) {
      console.error("[syncMissingFixtureReferees]", error);
      break;
    }
  }

  return { updated, checked, statusUpdated };
}
