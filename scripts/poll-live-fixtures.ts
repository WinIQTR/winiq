/**
 * API-Football live score poller.
 *
 * - GET /fixtures?live=all → upsert Match status/scores/statusShort/elapsed
 * - Re-check DB rows still marked LIVE but missing from live feed (FT transition)
 * - Reconcile recent stale SCHEDULED (kickoff passed, still SCHEDULED)
 *
 * Does NOT replace `pnpm refresh` (daily/6h schedule sync).
 *
 * Usage:
 *   pnpm live:poll
 *   pnpm live:poll -- --once
 *   pnpm live:poll -- --loop --interval-sec=90
 *   pnpm live:poll -- --no-stale
 *   pnpm live:poll -- --dry-run
 */

import "dotenv/config";

import { apiFootballRequest } from "@/lib/api-football/client";
import {
  mapApiFootballFixtureStatus,
  resolveFixtureScores,
} from "@/lib/api-football/fixture-status";
import { prisma } from "@/lib/prisma";

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    status: {
      short?: string | null;
      elapsed?: number | null;
    };
  };
  league?: { id?: number; name?: string; season?: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home?: number | null; away?: number | null };
  score?: {
    fulltime?: { home?: number | null; away?: number | null };
    halftime?: { home?: number | null; away?: number | null };
  };
};

type PollSummary = {
  at: string;
  liveFeedCount: number;
  updated: number;
  unchanged: number;
  missingInDb: number;
  staleChecked: number;
  staleUpdated: number;
  liveFollowUp: number;
  apiRequests: number;
  dryRun: boolean;
  samples: Array<{
    apiId: number;
    match: string;
    status: string;
    statusShort: string | null;
    score: string;
    elapsed: number | null;
  }>;
};

const STALE_LOOKBACK_HOURS = 36;
const DEFAULT_INTERVAL_SEC = 90;
const IDLE_INTERVAL_SEC = 900;
/** Free plan rejects `ids=`; single `id=` and `date=` remain available. */
const MAX_SINGLE_ID_FOLLOWUPS = 40;

function parseArgs(argv: string[]) {
  const once = argv.includes("--once") || !argv.includes("--loop");
  const loop = argv.includes("--loop");
  const dryRun = argv.includes("--dry-run");
  const noStale = argv.includes("--no-stale");
  const intervalFlag = argv.find((item) => item.startsWith("--interval-sec="));
  const parsed = intervalFlag
    ? Number(intervalFlag.split("=")[1])
    : DEFAULT_INTERVAL_SEC;
  const intervalSec = Number.isFinite(parsed)
    ? Math.min(120, Math.max(60, Math.round(parsed)))
    : DEFAULT_INTERVAL_SEC;

  return {
    loop: loop && !argv.includes("--once"),
    once: once && !loop,
    dryRun,
    reconcileStale: !noStale,
    intervalSec,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function istanbulDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(value);
}

async function fetchLiveAll(): Promise<{ fixtures: ApiFixture[]; requests: number }> {
  const result = await apiFootballRequest<ApiFixture[]>("/fixtures", {
    live: "all",
  });
  return { fixtures: result.response ?? [], requests: 1 };
}

/** Free-plan safe: one fixture per request via `id=`. */
async function fetchFixturesBySingleIds(
  ids: number[],
): Promise<{ fixtures: ApiFixture[]; requests: number }> {
  const unique = [...new Set(ids)].slice(0, MAX_SINGLE_ID_FOLLOWUPS);
  if (!unique.length) return { fixtures: [], requests: 0 };

  let requests = 0;
  const fixtures: ApiFixture[] = [];
  for (const id of unique) {
    const result = await apiFootballRequest<ApiFixture[]>("/fixtures", { id });
    requests += 1;
    fixtures.push(...(result.response ?? []));
  }
  return { fixtures, requests };
}

/** Free-plan safe stale path: pull whole calendar days, filter to our apiIds. */
async function fetchFixturesByDates(
  dateKeys: string[],
): Promise<{ fixtures: ApiFixture[]; requests: number }> {
  const unique = [...new Set(dateKeys)];
  if (!unique.length) return { fixtures: [], requests: 0 };

  let requests = 0;
  const fixtures: ApiFixture[] = [];
  for (const date of unique) {
    const result = await apiFootballRequest<ApiFixture[]>("/fixtures", {
      date,
      timezone: "Europe/Istanbul",
    });
    requests += 1;
    fixtures.push(...(result.response ?? []));
  }
  return { fixtures, requests };
}

async function applyFixtureUpdates(
  fixtures: ApiFixture[],
  options: { dryRun: boolean },
): Promise<{
  updated: number;
  unchanged: number;
  missingInDb: number;
  samples: PollSummary["samples"];
}> {
  let updated = 0;
  let unchanged = 0;
  let missingInDb = 0;
  const samples: PollSummary["samples"] = [];

  for (const row of fixtures) {
    const apiId = row.fixture.id;
    const statusShort = row.fixture.status.short?.trim() || null;
    const status = mapApiFootballFixtureStatus(statusShort);
    const elapsedMinutes =
      typeof row.fixture.status.elapsed === "number"
        ? row.fixture.status.elapsed
        : null;
    const { homeScore, awayScore } = resolveFixtureScores({
      goalsHome: row.goals.home,
      goalsAway: row.goals.away,
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

    const existing = await prisma.match.findUnique({
      where: { apiId },
      select: {
        id: true,
        status: true,
        statusShort: true,
        homeScore: true,
        awayScore: true,
        elapsedMinutes: true,
      },
    });

    if (!existing) {
      missingInDb += 1;
      continue;
    }

    const changed =
      existing.status !== status ||
      existing.statusShort !== statusShort ||
      existing.homeScore !== homeScore ||
      existing.awayScore !== awayScore ||
      existing.elapsedMinutes !== elapsedMinutes;

    if (!changed) {
      unchanged += 1;
    } else if (!options.dryRun) {
      await prisma.match.update({
        where: { apiId },
        data: {
          status,
          statusShort,
          homeScore,
          awayScore,
          elapsedMinutes,
          ...(halfTimeHomeScore !== undefined
            ? { halfTimeHomeScore }
            : {}),
          ...(halfTimeAwayScore !== undefined
            ? { halfTimeAwayScore }
            : {}),
        },
      });
      updated += 1;
    } else {
      updated += 1;
    }

    if (samples.length < 8) {
      samples.push({
        apiId,
        match: `${row.teams.home.name} vs ${row.teams.away.name}`,
        status,
        statusShort,
        score: `${homeScore ?? "–"}-${awayScore ?? "–"}`,
        elapsed: elapsedMinutes,
      });
    }
  }

  return { updated, unchanged, missingInDb, samples };
}

async function reconcileLingeringLive(
  liveApiIds: Set<number>,
  options: { dryRun: boolean },
): Promise<{ updated: number; requests: number; samples: PollSummary["samples"] }> {
  const lingering = await prisma.match.findMany({
    where: {
      status: "LIVE",
      ...(liveApiIds.size
        ? { apiId: { notIn: [...liveApiIds] } }
        : {}),
    },
    select: { apiId: true },
    take: 100,
  });

  if (!lingering.length) {
    return { updated: 0, requests: 0, samples: [] };
  }

  const fetched = await fetchFixturesBySingleIds(lingering.map((row) => row.apiId));
  const applied = await applyFixtureUpdates(fetched.fixtures, options);
  return {
    updated: applied.updated,
    requests: fetched.requests,
    samples: applied.samples,
  };
}

async function reconcileStaleScheduled(options: {
  dryRun: boolean;
}): Promise<{ checked: number; updated: number; requests: number; samples: PollSummary["samples"] }> {
  const now = new Date();
  const lookback = new Date(now.getTime() - STALE_LOOKBACK_HOURS * 3600_000);

  const stale = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      kickoffAt: { lte: now, gte: lookback },
    },
    select: { apiId: true, kickoffAt: true },
    orderBy: { kickoffAt: "asc" },
    take: 400,
  });

  if (!stale.length) {
    return { checked: 0, updated: 0, requests: 0, samples: [] };
  }

  const staleApiIds = new Set(stale.map((row) => row.apiId));
  const dateKeys = [...new Set(stale.map((row) => istanbulDateKey(row.kickoffAt)))];
  // Cap API spend: today + lookback days only (usually 2 date keys).
  const fetched = await fetchFixturesByDates(dateKeys.slice(0, 3));
  const relevant = fetched.fixtures.filter((row) => staleApiIds.has(row.fixture.id));
  const applied = await applyFixtureUpdates(relevant, options);
  return {
    checked: stale.length,
    updated: applied.updated,
    requests: fetched.requests,
    samples: applied.samples,
  };
}

async function runOnce(options: {
  dryRun: boolean;
  reconcileStale: boolean;
}): Promise<PollSummary> {
  let apiRequests = 0;
  const live = await fetchLiveAll();
  apiRequests += live.requests;

  const liveApplied = await applyFixtureUpdates(live.fixtures, options);
  const liveIds = new Set(live.fixtures.map((row) => row.fixture.id));

  const followUp = await reconcileLingeringLive(liveIds, options);
  apiRequests += followUp.requests;

  let staleChecked = 0;
  let staleUpdated = 0;
  const staleSamples: PollSummary["samples"] = [];
  if (options.reconcileStale) {
    const stale = await reconcileStaleScheduled(options);
    apiRequests += stale.requests;
    staleChecked = stale.checked;
    staleUpdated = stale.updated;
    staleSamples.push(...stale.samples);
  }

  const samples = [
    ...liveApplied.samples,
    ...followUp.samples,
    ...staleSamples,
  ].slice(0, 12);

  return {
    at: new Date().toISOString(),
    liveFeedCount: live.fixtures.length,
    updated: liveApplied.updated + followUp.updated + staleUpdated,
    unchanged: liveApplied.unchanged,
    missingInDb: liveApplied.missingInDb,
    staleChecked,
    staleUpdated,
    liveFollowUp: followUp.updated,
    apiRequests,
    dryRun: options.dryRun,
    samples,
  };
}

function printSummary(summary: PollSummary) {
  console.log("");
  console.log("========================================");
  console.log("LIVE FIXTURE POLL");
  console.log("========================================");
  console.log(`At (UTC): ${summary.at}`);
  console.log(`Dry run: ${summary.dryRun}`);
  console.log(`Live feed: ${summary.liveFeedCount}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Unchanged: ${summary.unchanged}`);
  console.log(`Missing in DB: ${summary.missingInDb}`);
  console.log(`LIVE follow-up updates: ${summary.liveFollowUp}`);
  console.log(`Stale SCHEDULED checked: ${summary.staleChecked}`);
  console.log(`Stale SCHEDULED updated: ${summary.staleUpdated}`);
  console.log(`API requests: ${summary.apiRequests}`);
  if (summary.samples.length) {
    console.log("");
    console.table(summary.samples);
  }
  console.log("");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.loop) {
    const summary = await runOnce({
      dryRun: args.dryRun,
      reconcileStale: args.reconcileStale,
    });
    printSummary(summary);
    return;
  }

  console.log(
    `Live poller loop started · interval ${args.intervalSec}s (match window) · idle ${IDLE_INTERVAL_SEC}s`,
  );

  for (;;) {
    const summary = await runOnce({
      dryRun: args.dryRun,
      reconcileStale: args.reconcileStale,
    });
    printSummary(summary);

    const inWindow =
      summary.liveFeedCount > 0 ||
      summary.staleChecked > 0 ||
      summary.liveFollowUp > 0;
    const waitSec = inWindow ? args.intervalSec : IDLE_INTERVAL_SEC;
    console.log(`Sleeping ${waitSec}s…`);
    await sleep(waitSec * 1000);
  }
}

main()
  .catch((error: unknown) => {
    console.error("");
    console.error("Live fixture poll failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
