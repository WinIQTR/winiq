export type ApiFootballStatus = {
  subscription?: {
    plan?: string;
    end?: string;
    active?: boolean;
  };

  requests?: {
    current?: number;
    limit_day?: number;
  };
};

export type ApiQuotaSummary = {
  state:
    | "CONNECTED"
    | "NOT_CONFIGURED"
    | "UNAVAILABLE";
  plan: string | null;
  active: boolean | null;
  endsAt: string | null;
  usedToday: number | null;
  dailyLimit: number | null;
  remainingToday: number | null;
};

export type LeagueCoverageSummary = {
  leagueApiId: number;
  leagueName: string;
  fixtures: number;
  finished: number;
  scheduled: number;
  live: number;
  postponedOrCancelled: number;
  missingFinalScores: number;
  publishedCandidates: number;
  lastDatabaseUpdateAt: string | null;
};

export type CoverageMatch = {
  id: number;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  updatedAt: Date;
  leagueApiId: number;
  leagueName: string;
};

function finiteNumber(
  value: unknown,
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

export function summarizeApiQuota(
  status: ApiFootballStatus,
): ApiQuotaSummary {
  const usedToday =
    finiteNumber(
      status.requests?.current,
    );

  const dailyLimit =
    finiteNumber(
      status.requests?.limit_day,
    );

  return {
    state: "CONNECTED",
    plan:
      status.subscription?.plan
        ?.trim() || null,
    active:
      typeof status.subscription?.active ===
      "boolean"
        ? status.subscription.active
        : null,
    endsAt:
      status.subscription?.end
        ?.trim() || null,
    usedToday,
    dailyLimit,
    remainingToday:
      usedToday !== null &&
      dailyLimit !== null
        ? Math.max(
            0,
            dailyLimit - usedToday,
          )
        : null,
  };
}

export function summarizeLeagueCoverage(
  matches: readonly CoverageMatch[],
  publishedMatchIds: ReadonlySet<number>,
): LeagueCoverageSummary[] {
  const rows =
    new Map<
      number,
      LeagueCoverageSummary
    >();

  for (const match of matches) {
    const existing =
      rows.get(match.leagueApiId) ?? {
        leagueApiId:
          match.leagueApiId,
        leagueName:
          match.leagueName,
        fixtures: 0,
        finished: 0,
        scheduled: 0,
        live: 0,
        postponedOrCancelled: 0,
        missingFinalScores: 0,
        publishedCandidates: 0,
        lastDatabaseUpdateAt: null,
      };

    existing.fixtures += 1;

    if (match.status === "FINISHED") {
      existing.finished += 1;

      if (
        match.homeScore === null ||
        match.awayScore === null
      ) {
        existing.missingFinalScores += 1;
      }
    } else if (match.status === "SCHEDULED") {
      existing.scheduled += 1;
    } else if (match.status === "LIVE") {
      existing.live += 1;
    } else if (
      match.status === "POSTPONED" ||
      match.status === "CANCELLED"
    ) {
      existing.postponedOrCancelled += 1;
    }

    if (publishedMatchIds.has(match.id)) {
      existing.publishedCandidates += 1;
    }

    const updatedAt =
      match.updatedAt.toISOString();

    if (
      existing.lastDatabaseUpdateAt === null ||
      updatedAt > existing.lastDatabaseUpdateAt
    ) {
      existing.lastDatabaseUpdateAt =
        updatedAt;
    }

    rows.set(
      match.leagueApiId,
      existing,
    );
  }

  return [...rows.values()].sort(
    (first, second) =>
      first.leagueName.localeCompare(
        second.leagueName,
        "tr",
      ),
  );
}
