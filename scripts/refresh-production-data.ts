import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
  type TargetCompetition,
} from "@/config/competitions";

import {
  runPredictionArchiveAutomation,
  type PredictionArchiveAutomationSummary,
} from "@/lib/prediction-archive";

import {
  refreshUpcomingBookmakerOdds,
  type ProductionOddsRefreshSummary,
} from "@/lib/production-odds-refresh";

import {
  runValueBetArchiveAutomation,
  type ValueBetArchiveAutomationSummary,
} from "@/lib/value-bet-archive";

import {
  backupDisplayName,
  runProductionBackup,
} from "@/lib/production-backup";

import { generateProductionReports } from "@/lib/production-report";

import { prisma } from "@/lib/prisma";

type MatchStatusValue =
  | "SCHEDULED"
  | "LIVE"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED";

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
    };
  };
  league: {
    id: number;
    name: string;
    season: number;
    round: string | null;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo?: string | null;
    };
    away: {
      id: number;
      name: string;
      logo?: string | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score?: {
    fulltime?: {
      home: number | null;
      away: number | null;
    } | null;
  };
};

type ApiFootballFixtureResponse = {
  errors: Record<string, unknown> | unknown[];
  results: number;
  response: ApiFootballFixture[];
};

type CompetitionRefreshResult = {
  leagueApiId: number;
  leagueName: string;
  fixturesReceived: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  apiRequests: number;
  emptyResponse: boolean;
  errorMessage: string | null;
};

const DEFAULT_DAYS_AHEAD = 30;
const MAXIMUM_DAYS_AHEAD = 60;
const DEFAULT_RESULT_LOOKBACK_DAYS = 3;
const MAXIMUM_RESULT_LOOKBACK_DAYS = 14;
const DEFAULT_REQUEST_DELAY_MS = 500;

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Required environment variable ${name} is missing.`);
  }

  return value;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function formatApiDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getSeasonStartDate(value: Date): Date {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;

  return new Date(
    Date.UTC(
      month >= 7 ? year : year - 1,
      6,
      1,
    ),
  );
}

function resolveDateRange(
  daysAhead: number,
  resultLookbackDays: number,
): {
  from: string;
  to: string;
} {
  const configuredFrom = process.env.FIXTURE_FROM?.trim();
  const configuredTo = process.env.FIXTURE_TO?.trim();

  const today = new Date();

  const defaultFromDate = new Date(today);
  defaultFromDate.setUTCHours(0, 0, 0, 0);
  defaultFromDate.setUTCDate(
    defaultFromDate.getUTCDate() - resultLookbackDays,
  );

  const seasonStartDate = getSeasonStartDate(today);

  if (defaultFromDate < seasonStartDate) {
    defaultFromDate.setTime(seasonStartDate.getTime());
  }

  const fromDate = configuredFrom
    ? new Date(`${configuredFrom}T00:00:00.000Z`)
    : defaultFromDate;

  const toDate = configuredTo
    ? new Date(`${configuredTo}T23:59:59.999Z`)
    : new Date(today);

  if (!configuredTo) {
    toDate.setUTCHours(23, 59, 59, 999);
    toDate.setUTCDate(toDate.getUTCDate() + daysAhead);
  }

  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime())
  ) {
    throw new Error("FIXTURE_FROM or FIXTURE_TO contains an invalid date.");
  }

  if (fromDate > toDate) {
    throw new Error("FIXTURE_FROM cannot be later than FIXTURE_TO.");
  }

  return {
    from: formatApiDate(fromDate),
    to: formatApiDate(toDate),
  };
}

function inferSeasonYearFromDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`Cannot infer season from invalid date: ${value}.`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);

  // API-Football identifies a European 2026/27 season as season 2026.
  return month >= 7
    ? year
    : year - 1;
}

function resolveSeasonYear(from: string, to: string): {
  seasonYear: number;
  ignoredConfiguredSeason: string | null;
} {
  const fromSeason = inferSeasonYearFromDate(from);
  const toSeason = inferSeasonYearFromDate(to);

  if (fromSeason !== toSeason) {
    throw new Error(
      [
        "The fixture date range spans two football seasons.",
        `from=${from} (season=${fromSeason})`,
        `to=${to} (season=${toSeason})`,
        "Keep FIXTURE_FROM and FIXTURE_TO within one season.",
      ].join(" "),
    );
  }

  const configuredSeason =
    process.env.API_FOOTBALL_SEASON?.trim() ?? null;

  return {
    seasonYear: fromSeason,
    ignoredConfiguredSeason:
      configuredSeason && configuredSeason !== String(fromSeason)
        ? configuredSeason
        : null,
  };
}

function mapFixtureStatus(status: string): MatchStatusValue {
  if (["TBD", "NS"].includes(status)) return "SCHEDULED";

  if (
    [
      "1H",
      "HT",
      "2H",
      "ET",
      "BT",
      "P",
      "SUSP",
      "INT",
      "LIVE",
    ].includes(status)
  ) {
    return "LIVE";
  }

  if (["FT", "AET", "PEN"].includes(status)) return "FINISHED";
  if (status === "PST") return "POSTPONED";

  if (["CANC", "ABD", "AWD", "WO"].includes(status)) {
    return "CANCELLED";
  }

  return "SCHEDULED";
}

function hasApiErrors(
  errors: Record<string, unknown> | unknown[] | undefined,
): boolean {
  if (Array.isArray(errors)) return errors.length > 0;

  return Boolean(
    errors &&
    typeof errors === "object" &&
    Object.keys(errors).length > 0,
  );
}

async function fetchCompetitionFixtures(options: {
  apiKey: string;
  baseUrl: string;
  leagueApiId: number;
  seasonYear: number;
  from: string;
  to: string;
}): Promise<ApiFootballFixtureResponse> {
  const url = new URL("/fixtures", options.baseUrl);

  url.searchParams.set("league", String(options.leagueApiId));
  url.searchParams.set("season", String(options.seasonYear));
  url.searchParams.set("from", options.from);
  url.searchParams.set("to", options.to);
  url.searchParams.set("timezone", "Europe/Istanbul");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-apisports-key": options.apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `API-Football fixture request failed. HTTP ${response.status}. ${body}`,
    );
  }

  return response.json() as Promise<ApiFootballFixtureResponse>;
}

async function ensureTeam(apiTeam: {
  id: number;
  name: string;
  logo?: string | null;
}): Promise<{ id: number }> {
  return prisma.team.upsert({
    where: {
      apiId: apiTeam.id,
    },
    create: {
      apiId: apiTeam.id,
      name: apiTeam.name,
      logoUrl: apiTeam.logo ?? null,
    },
    update: {
      name: apiTeam.name,
      logoUrl: apiTeam.logo ?? undefined,
    },
    select: {
      id: true,
    },
  });
}

async function refreshCompetition(options: {
  competition: TargetCompetition;
  apiKey: string;
  baseUrl: string;
  seasonYear: number;
  from: string;
  to: string;
}): Promise<CompetitionRefreshResult> {
  const result: CompetitionRefreshResult = {
    leagueApiId: options.competition.apiId,
    leagueName: options.competition.name,
    fixturesReceived: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    apiRequests: 0,
    emptyResponse: false,
    errorMessage: null,
  };

  console.log("");
  console.log("----------------------------------------------");
  console.log(`${options.competition.name} (${options.competition.apiId})`);
  console.log("----------------------------------------------");

  try {
    const apiResult = await fetchCompetitionFixtures({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      leagueApiId: options.competition.apiId,
      seasonYear: options.seasonYear,
      from: options.from,
      to: options.to,
    });

    result.apiRequests += 1;

    if (hasApiErrors(apiResult.errors)) {
      throw new Error(
        `API-Football returned errors: ${JSON.stringify(apiResult.errors)}`,
      );
    }

    if (!Array.isArray(apiResult.response)) {
      throw new Error("API-Football returned an invalid response field.");
    }

    result.fixturesReceived = apiResult.response.length;
    console.log(`Fixtures received: ${result.fixturesReceived}`);

    if (apiResult.response.length === 0) {
      result.emptyResponse = true;
      console.log(
        [
          "The API returned no fixtures for this query.",
          `season=${options.seasonYear}`,
          `from=${options.from}`,
          `to=${options.to}`,
        ].join(" "),
      );

      return result;
    }

    const seasonRecord = await prisma.season.findFirst({
      where: {
        year: options.seasonYear,
        league: {
          apiId: options.competition.apiId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!seasonRecord) {
      result.skipped = apiResult.response.length;
      result.errorMessage = [
        "Season record was not found.",
        `league=${options.competition.apiId}`,
        `season=${options.seasonYear}`,
        "Run bootstrap-target-competitions first.",
      ].join(" ");

      console.warn(`SKIPPED: ${result.errorMessage}`);
      return result;
    }

    for (const fixture of apiResult.response) {
      try {
        const [homeTeam, awayTeam, existingMatch] = await Promise.all([
          ensureTeam(fixture.teams.home),
          ensureTeam(fixture.teams.away),
          prisma.match.findUnique({
            where: {
              apiId: fixture.fixture.id,
            },
            select: {
              id: true,
            },
          }),
        ]);

        const kickoffAt = new Date(fixture.fixture.date);
        const homeScore =
          fixture.score?.fulltime?.home ??
          fixture.goals.home;
        const awayScore =
          fixture.score?.fulltime?.away ??
          fixture.goals.away;

        if (Number.isNaN(kickoffAt.getTime())) {
          console.warn(
            `SKIPPED: Invalid date — ${fixture.teams.home.name} - ${fixture.teams.away.name}`,
          );
          result.skipped += 1;
          continue;
        }

        await prisma.match.upsert({
          where: {
            apiId: fixture.fixture.id,
          },
          create: {
            apiId: fixture.fixture.id,
            seasonId: seasonRecord.id,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            round: fixture.league.round,
            kickoffAt,
            status: mapFixtureStatus(fixture.fixture.status.short),
            homeScore,
            awayScore,
          },
          update: {
            seasonId: seasonRecord.id,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            round: fixture.league.round,
            kickoffAt,
            status: mapFixtureStatus(fixture.fixture.status.short),
            homeScore,
            awayScore,
          },
        });

        if (existingMatch) {
          result.updated += 1;
        } else {
          result.created += 1;
        }

        console.log(
          `${existingMatch ? "UPDATED" : "CREATED"}: ${fixture.teams.home.name} - ${fixture.teams.away.name}`,
        );
      } catch (error: unknown) {
        result.failed += 1;
        console.error(
          [
            "ERROR",
            `${fixture.teams.home.name} - ${fixture.teams.away.name}`,
            error instanceof Error
              ? error.message
              : String(error),
          ].join(": "),
        );
      }
    }

    return result;
  } catch (error: unknown) {
    result.errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(`Competition refresh failed: ${result.errorMessage}`);
    return result;
  }
}

function printArchiveSummary(
  archive: PredictionArchiveAutomationSummary,
): void {
  console.log("");
  console.log("==============================================");
  console.log("PREDICTION ARCHIVE");
  console.log("==============================================");

  console.table({
    "Matches evaluated": archive.publication.matchesEvaluated,
    "Picks considered": archive.publication.picksConsidered,
    "Newly published": archive.publication.published,
    "Duplicates skipped": archive.publication.duplicatesSkipped,
    "Kickoff passed": archive.publication.kickoffSkipped,
    "Pending evaluated": archive.settlement.pendingEvaluated,
    Won: archive.settlement.won,
    Lost: archive.settlement.lost,
    Void: archive.settlement.voided,
    "Unsupported markets": archive.settlement.unsupportedMarkets,
    "Incomplete scores": archive.settlement.incompleteScores,
    "Rescheduled picks": archive.settlement.rescheduled,
    "Dashboard predictions": archive.dashboardSnapshot.predictions,
    "Snapshot generated at":
      archive.dashboardSnapshot.generatedAt.toISOString(),
  });
}

function printOddsSummary(odds: ProductionOddsRefreshSummary): void {
  console.log("");
  console.log("==============================================");
  console.log("BOOKMAKER ODDS REFRESH");
  console.log("==============================================");
  console.table({
    Enabled: odds.enabled,
    Candidates: odds.candidates,
    Attempted: odds.attempted,
    Imported: odds.imported,
    "No odds data": odds.noData,
    Failed: odds.failed,
    Deferred: odds.deferred,
    Bookmakers: odds.bookmakers,
    Snapshots: odds.snapshots,
    Markets: odds.markets,
    Selections: odds.selections,
  });

  for (const warning of odds.warnings) {
    console.warn(`ODDS WARNING: ${warning}`);
  }
}

function printValueBetSummary(value: ValueBetArchiveAutomationSummary): void {
  console.log("");
  console.log("==============================================");
  console.log("VALUE BET ARCHIVE");
  console.log("==============================================");
  console.table({
    "Matches evaluated": value.publication.matchesEvaluated,
    Comparisons: value.publication.comparisons,
    "Publishable found": value.publication.publishableFound,
    "Newly published": value.publication.published,
    "Duplicates skipped": value.publication.duplicatesSkipped,
    "Calculation failures": value.publication.calculationFailures,
    "Pending evaluated": value.settlement.pendingEvaluated,
    Won: value.settlement.won,
    Lost: value.settlement.lost,
    Void: value.settlement.voided,
    "Dashboard upcoming": value.dashboard.upcoming,
    "Dashboard settled": value.dashboard.settled,
    "Coupons published": value.coupons.published,
    "Coupon duplicates": value.coupons.duplicatesSkipped,
    "Coupons won": value.coupons.won,
    "Coupons lost": value.coupons.lost,
    "Coupons void": value.coupons.voided,
  });

  for (const warning of value.warnings) {
    console.warn(`VALUE WARNING: ${warning}`);
  }
}

async function main(): Promise<void> {
  const apiKey = getRequiredEnvironmentVariable("API_FOOTBALL_KEY");
  const baseUrl = getRequiredEnvironmentVariable("API_FOOTBALL_BASE_URL");
  const daysAhead = parsePositiveInteger(
    process.env.PREDICTION_DAYS,
    DEFAULT_DAYS_AHEAD,
    MAXIMUM_DAYS_AHEAD,
  );
  const resultLookbackDays = parsePositiveInteger(
    process.env.PREDICTION_RESULT_LOOKBACK_DAYS,
    DEFAULT_RESULT_LOOKBACK_DAYS,
    MAXIMUM_RESULT_LOOKBACK_DAYS,
  );
  const requestDelayMs = parsePositiveInteger(
    process.env.API_REQUEST_DELAY_MS,
    DEFAULT_REQUEST_DELAY_MS,
    10_000,
  );
  const { from, to } = resolveDateRange(
    daysAhead,
    resultLookbackDays,
  );
  const { seasonYear, ignoredConfiguredSeason } =
    resolveSeasonYear(from, to);

  console.log("");
  console.log("==============================================");
  console.log("PRODUCTION DATA REFRESH");
  console.log("==============================================");

  console.table({
    Season: seasonYear,
    "Start date": from,
    "End date": to,
    "Result lookback": `${resultLookbackDays} days`,
    Competitions: ACTIVE_COMPETITIONS.length,
    "API delay": `${requestDelayMs} ms`,
  });

  if (ignoredConfiguredSeason) {
    console.warn(
      [
        "WARNING:",
        `API_FOOTBALL_SEASON=${ignoredConfiguredSeason}`,
        "does not match the date range and was ignored.",
        `Inferred season=${seasonYear}`,
      ].join(" "),
    );
  }

  const results: CompetitionRefreshResult[] = [];

  for (let index = 0; index < ACTIVE_COMPETITIONS.length; index += 1) {
    const competition = ACTIVE_COMPETITIONS[index];
    const result = await refreshCompetition({
      competition,
      apiKey,
      baseUrl,
      seasonYear,
      from,
      to,
    });

    results.push(result);

    if (index < ACTIVE_COMPETITIONS.length - 1) {
      await sleep(requestDelayMs);
    }
  }

  const totals = results.reduce(
    (total, result) => ({
      fixturesReceived: total.fixturesReceived + result.fixturesReceived,
      created: total.created + result.created,
      updated: total.updated + result.updated,
      skipped: total.skipped + result.skipped,
      failed: total.failed + result.failed,
      apiRequests: total.apiRequests + result.apiRequests,
      competitionErrors:
        total.competitionErrors + (result.errorMessage ? 1 : 0),
      emptyResponses:
        total.emptyResponses + (result.emptyResponse ? 1 : 0),
    }),
    {
      fixturesReceived: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      apiRequests: 0,
      competitionErrors: 0,
      emptyResponses: 0,
    },
  );

  console.log("");
  console.log("==============================================");
  console.log("COMPETITION RESULTS");
  console.log("==============================================");

  console.table(
    results.map((result) => ({
      League: result.leagueName,
      "API ID": result.leagueApiId,
      Received: result.fixturesReceived,
      Created: result.created,
      Updated: result.updated,
      Skipped: result.skipped,
      Failed: result.failed,
      Status: result.errorMessage
        ? "WARNING"
        : result.emptyResponse
          ? "NO FIXTURES"
          : "OK",
    })),
  );

  console.log("");
  console.log("==============================================");
  console.log("REFRESH SUMMARY");
  console.log("==============================================");
  console.table({
    "API requests": totals.apiRequests,
    "API fixtures": totals.fixturesReceived,
    "New matches": totals.created,
    "Updated matches": totals.updated,
    "Skipped matches": totals.skipped,
    "Failed matches": totals.failed,
    "Competition warnings": totals.competitionErrors,
    "Empty competitions": totals.emptyResponses,
  });

  console.log("");
  console.log(
    "Refreshing available bookmaker odds. Missing odds never stop the prediction pipeline...",
  );

  const odds = await refreshUpcomingBookmakerOdds({
    apiKey,
    baseUrl,
  });
  printOddsSummary(odds);

  console.log("");
  console.log(
    "Calculating and archiving pre-kickoff predictions. This can take several minutes...",
  );

  const archive = await runPredictionArchiveAutomation();
  printArchiveSummary(archive);

  console.log("");
  console.log("Calculating, publishing and settling Value Bets...");

  const valueBetArchive = await runValueBetArchiveAutomation();
  printValueBetSummary(valueBetArchive);

  let hasWarnings =
    totals.fixturesReceived === 0 ||
    totals.failed > 0 ||
    totals.competitionErrors > 0 ||
    archive.settlement.unsupportedMarkets > 0 ||
    archive.settlement.incompleteScores > 0;

  if (!hasWarnings) {
    console.log("");
    console.log("Creating the daily production backup when due...");
    try {
      const backup = await runProductionBackup();
      console.table({
        "Backup status": backup.status,
        Backup: backupDisplayName(backup.backupPath),
        Files: backup.fileCount,
        "Total MB": (backup.totalBytes / 1024 / 1024).toFixed(2),
      });
    } catch (error: unknown) {
      hasWarnings = true;
      console.error(
        `BACKUP WARNING: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log("");
  console.log("Generating daily and weekly production reports...");
  try {
    const reports = await generateProductionReports();
    console.table({
      "Daily report": reports.daily.period.key,
      "Daily settled": reports.daily.settled.settled,
      "Weekly report": reports.weekly.period.key,
      "Weekly settled": reports.weekly.settled.settled,
      "Model health": reports.daily.modelHealth.overallLevel,
      "Production lock": reports.daily.production.automaticModelChangeAllowed
        ? "FAIL"
        : "PASS",
    });
  } catch (error: unknown) {
    hasWarnings = true;
    console.error(
      `REPORT WARNING: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  console.log("");

  if (hasWarnings) {
    console.warn("Refresh completed with warnings.");
    process.exitCode = 2;
  } else {
    console.log("Production refresh completed successfully.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("");
    console.error("Production refresh failed.");
    console.error(
      error instanceof Error
        ? error.message
        : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
