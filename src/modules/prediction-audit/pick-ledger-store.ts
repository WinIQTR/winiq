/**
 * Persist append-only pick ledger under reports/ (JSON).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  computeLedgerAdditions,
  type PickLedgerEntry,
} from "@/modules/prediction-audit/pick-ledger";
import type { UpcomingPickRow } from "@/modules/prediction-audit/types";

export const DEFAULT_PICK_LEDGER_PATH = path.join(
  process.cwd(),
  "reports",
  "pick-change-ledger.json",
);

type StoredLedger = {
  version: 1;
  updatedAt: string;
  entries: Array<{
    fixtureId: string;
    kickoffAt: string;
    leagueKey: string;
    homeTeam: string;
    awayTeam: string;
    pick: "1" | "X" | "2";
    pickWrittenAt: string;
    firstSeenAt: string;
  }>;
};

function toEntry(row: StoredLedger["entries"][number]): PickLedgerEntry {
  return {
    fixtureId: row.fixtureId,
    kickoffAt: new Date(row.kickoffAt),
    leagueKey: row.leagueKey,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    pick: row.pick,
    pickWrittenAt: new Date(row.pickWrittenAt),
    firstSeenAt: new Date(row.firstSeenAt),
  };
}

export async function loadPickLedger(
  filePath = DEFAULT_PICK_LEDGER_PATH,
): Promise<PickLedgerEntry[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as StoredLedger;
    if (!parsed?.entries || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.map(toEntry);
  } catch {
    return [];
  }
}

export async function savePickLedger(
  entries: readonly PickLedgerEntry[],
  filePath = DEFAULT_PICK_LEDGER_PATH,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload: StoredLedger = {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: entries.map((row) => ({
      fixtureId: row.fixtureId,
      kickoffAt: row.kickoffAt.toISOString(),
      leagueKey: row.leagueKey,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      pick: row.pick,
      pickWrittenAt: row.pickWrittenAt.toISOString(),
      firstSeenAt: row.firstSeenAt.toISOString(),
    })),
  };
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function appendUpcomingPicksToLedger(
  upcoming: readonly UpcomingPickRow[],
  options?: {
    now?: Date;
    filePath?: string;
  },
): Promise<{ added: number; total: number }> {
  const filePath = options?.filePath ?? DEFAULT_PICK_LEDGER_PATH;
  const now = options?.now ?? new Date();
  const existing = await loadPickLedger(filePath);
  const additions = computeLedgerAdditions(upcoming, existing, now);
  if (additions.length === 0) {
    return { added: 0, total: existing.length };
  }
  const next = [...existing, ...additions];
  await savePickLedger(next, filePath);
  return { added: additions.length, total: next.length };
}
