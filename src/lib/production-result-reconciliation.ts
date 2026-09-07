import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

export type ReconciliationMatchRow = {
  id: number;
  apiId: number;
  kickoffAt: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  updatedAt: Date;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
};

export type ReconciliationPickRow = {
  matchId: number;
  result: string;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
};

export type ResultReconciliationIssueCode =
  | "MISSING_FINAL_SCORE"
  | "PENDING_SETTLEMENT"
  | "ARCHIVE_SCORE_MISMATCH"
  | "OVERDUE_MATCH_STATUS";

export type ResultReconciliationIssue = {
  code: ResultReconciliationIssueCode;
  severity: "WARNING" | "CRITICAL";
  matchId: number;
  fixtureApiId: number;
  kickoffAt: string;
  leagueName: string;
  match: string;
  detail: string;
};

export type ResultReconciliationSummary = {
  totalFixtures: number;
  finishedFixtures: number;
  archivedMatches: number;
  missingFinalScores: number;
  pendingSettlements: number;
  archiveScoreMismatches: number;
  overdueStatuses: number;
  issueCount: number;
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  issues: ResultReconciliationIssue[];
};

const OVERDUE_GRACE_HOURS = 6;
const MAXIMUM_DISPLAYED_ISSUES = 100;

function issueBase(match: ReconciliationMatchRow) {
  return {
    matchId: match.id,
    fixtureApiId: match.apiId,
    kickoffAt: match.kickoffAt.toISOString(),
    leagueName: match.leagueName,
    match: `${match.homeTeam} - ${match.awayTeam}`,
  };
}

export function summarizeResultReconciliation(
  matches: readonly ReconciliationMatchRow[],
  picks: readonly ReconciliationPickRow[],
  now = new Date(),
): ResultReconciliationSummary {
  const picksByMatchId =
    new Map<number, ReconciliationPickRow[]>();

  for (const pick of picks) {
    const existing =
      picksByMatchId.get(pick.matchId) ?? [];
    existing.push(pick);
    picksByMatchId.set(pick.matchId, existing);
  }

  const issues: ResultReconciliationIssue[] = [];
  let finishedFixtures = 0;
  let missingFinalScores = 0;
  let pendingSettlements = 0;
  let archiveScoreMismatches = 0;
  let overdueStatuses = 0;

  const overdueBefore =
    now.getTime() -
    OVERDUE_GRACE_HOURS * 60 * 60 * 1_000;

  for (const match of matches) {
    const matchPicks =
      picksByMatchId.get(match.id) ?? [];

    if (match.status === "FINISHED") {
      finishedFixtures += 1;

      if (
        match.homeScore === null ||
        match.awayScore === null
      ) {
        missingFinalScores += 1;
        issues.push({
          ...issueBase(match),
          code: "MISSING_FINAL_SCORE",
          severity: "WARNING",
          detail:
            "The fixture is FINISHED but its final score is incomplete.",
        });
      } else {
        if (
          matchPicks.some(
            (pick) =>
              pick.result === "PENDING",
          )
        ) {
          pendingSettlements += 1;
          issues.push({
            ...issueBase(match),
            code: "PENDING_SETTLEMENT",
            severity: "WARNING",
            detail:
              "A final score exists but at least one archived prediction is still PENDING.",
          });
        }

        const hasMismatch =
          matchPicks.some(
            (pick) =>
              pick.result !== "PENDING" &&
              pick.actualHomeScore !== null &&
              pick.actualAwayScore !== null &&
              (
                pick.actualHomeScore !==
                  match.homeScore ||
                pick.actualAwayScore !==
                  match.awayScore
              ),
          );

        if (hasMismatch) {
          archiveScoreMismatches += 1;
          issues.push({
            ...issueBase(match),
            code: "ARCHIVE_SCORE_MISMATCH",
            severity: "CRITICAL",
            detail:
              `The immutable archive score differs from the database score ${match.homeScore}-${match.awayScore}. Manual review is required.`,
          });
        }
      }
    }

    if (
      (
        match.status === "SCHEDULED" ||
        match.status === "LIVE"
      ) &&
      match.kickoffAt.getTime() <
        overdueBefore
    ) {
      overdueStatuses += 1;
      issues.push({
        ...issueBase(match),
        code: "OVERDUE_MATCH_STATUS",
        severity: "WARNING",
        detail:
          `The match remains ${match.status} more than ${OVERDUE_GRACE_HOURS} hours after kickoff.`,
      });
    }
  }

  const status =
    archiveScoreMismatches > 0
      ? "CRITICAL"
      : issues.length > 0
        ? "WARNING"
        : "HEALTHY";

  return {
    totalFixtures: matches.length,
    finishedFixtures,
    archivedMatches:
      picksByMatchId.size,
    missingFinalScores,
    pendingSettlements,
    archiveScoreMismatches,
    overdueStatuses,
    issueCount: issues.length,
    status,
    issues: issues
      .sort(
        (first, second) =>
          second.kickoffAt.localeCompare(
            first.kickoffAt,
          ),
      )
      .slice(0, MAXIMUM_DISPLAYED_ISSUES),
  };
}

export async function buildProductionResultReconciliation(
  now = new Date(),
): Promise<ResultReconciliationSummary> {
  const {
    prisma,
  } = await import("@/lib/prisma");

  const [matches, picks] = await Promise.all([
    prisma.match.findMany({
      where: {
        season: {
          year: ACTIVE_SEASON_YEAR,
        },
      },
      select: {
        id: true,
        apiId: true,
        kickoffAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        updatedAt: true,
        season: {
          select: {
            league: {
              select: {
                name: true,
              },
            },
          },
        },
        homeTeam: {
          select: {
            name: true,
          },
        },
        awayTeam: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        kickoffAt: "asc",
      },
      take: 10_000,
    }),
    prisma.smartPickHistory.findMany({
      where: {
        match: {
          season: {
            year: ACTIVE_SEASON_YEAR,
          },
        },
      },
      select: {
        matchId: true,
        result: true,
        actualHomeScore: true,
        actualAwayScore: true,
      },
      orderBy: {
        id: "asc",
      },
      take: 50_000,
    }),
  ]);

  return summarizeResultReconciliation(
    matches.map((match) => ({
      id: match.id,
      apiId: match.apiId,
      kickoffAt: match.kickoffAt,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      updatedAt: match.updatedAt,
      leagueName:
        match.season.league.name,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
    })),
    picks,
    now,
  );
}
