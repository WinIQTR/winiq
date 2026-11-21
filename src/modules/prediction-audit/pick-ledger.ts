/**
 * Append-only pre-kickoff pick-change ledger (open-data picks/ledger.csv).
 * Lines are never edited or removed; a changed pick adds a new line.
 */

import type {
  OneXTwoResult,
  UpcomingPickRow,
} from "@/modules/prediction-audit/types";

export type PickLedgerEntry = {
  fixtureId: string;
  kickoffAt: Date;
  leagueKey: string;
  homeTeam: string;
  awayTeam: string;
  pick: OneXTwoResult;
  pickWrittenAt: Date;
  firstSeenAt: Date;
};

export type PickLedgerSummary = {
  entries: number;
  fixtures: number;
  changes: number;
};

export function ledgerSummary(
  ledger: readonly PickLedgerEntry[],
): PickLedgerSummary {
  const byFixture = new Map<string, number>();
  for (const row of ledger) {
    byFixture.set(row.fixtureId, (byFixture.get(row.fixtureId) ?? 0) + 1);
  }
  let changes = 0;
  for (const count of byFixture.values()) {
    if (count > 1) changes += count - 1;
  }
  return {
    entries: ledger.length,
    fixtures: byFixture.size,
    changes,
  };
}

/**
 * Returns lines to append: a pick not yet recorded for its match, seen before kick-off.
 * If the pick changed, a new line is added and earlier ones stay.
 */
export function computeLedgerAdditions(
  upcoming: readonly UpcomingPickRow[],
  ledger: readonly PickLedgerEntry[],
  now: Date = new Date(),
): PickLedgerEntry[] {
  const latest = new Map<string, OneXTwoResult>();
  for (const row of ledger) {
    latest.set(row.fixtureId, row.pick);
  }
  // One current pick per fixture from this feed (latest pickWrittenAt wins).
  const currentByFixture = new Map<string, UpcomingPickRow>();
  for (const row of upcoming) {
    const prev = currentByFixture.get(row.fixtureId);
    if (
      !prev ||
      row.pickWrittenAt.getTime() >= prev.pickWrittenAt.getTime()
    ) {
      currentByFixture.set(row.fixtureId, row);
    }
  }
  const out: PickLedgerEntry[] = [];
  const sorted = [...currentByFixture.values()].sort(
    (a, b) =>
      a.kickoffAt.getTime() - b.kickoffAt.getTime() ||
      a.fixtureId.localeCompare(b.fixtureId),
  );
  for (const row of sorted) {
    if (row.kickoffAt.getTime() <= now.getTime()) continue;
    if (latest.get(row.fixtureId) === row.pick) continue;
    latest.set(row.fixtureId, row.pick);
    out.push({
      fixtureId: row.fixtureId,
      kickoffAt: row.kickoffAt,
      leagueKey: row.leagueKey,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      pick: row.pick,
      pickWrittenAt: row.pickWrittenAt,
      firstSeenAt: now,
    });
  }
  return out;
}

/** Last pre-kickoff pick for a fixture (the one that counts). */
export function latestPickBeforeKickoff(
  ledger: readonly PickLedgerEntry[],
  fixtureId: string,
  kickoffAt: Date,
): PickLedgerEntry | null {
  let best: PickLedgerEntry | null = null;
  for (const row of ledger) {
    if (row.fixtureId !== fixtureId) continue;
    if (row.firstSeenAt.getTime() > kickoffAt.getTime()) continue;
    if (
      !best ||
      row.firstSeenAt.getTime() > best.firstSeenAt.getTime() ||
      (row.firstSeenAt.getTime() === best.firstSeenAt.getTime() &&
        row.pickWrittenAt.getTime() > best.pickWrittenAt.getTime())
    ) {
      best = row;
    }
  }
  return best;
}

export function serializeLedgerCsv(
  ledger: readonly PickLedgerEntry[],
): string {
  const header =
    "fixture_id,kickoff_utc,league_slug,home_team,away_team,pick,pick_written_utc,first_seen_utc";
  const lines = ledger.map((row) =>
    [
      row.fixtureId,
      row.kickoffAt.toISOString(),
      row.leagueKey,
      csvEscape(row.homeTeam),
      csvEscape(row.awayTeam),
      row.pick,
      row.pickWrittenAt.toISOString(),
      row.firstSeenAt.toISOString(),
    ].join(","),
  );
  return [header, ...lines].join("\n") + (lines.length ? "\n" : "");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
