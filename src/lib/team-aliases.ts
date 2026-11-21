import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildAliasIndex,
  canonicalizeTeamName,
  DEFAULT_TEAM_ALIASES,
  type TeamAliasTable,
} from "@/modules/match-context-engine";

const ALIAS_PATH = path.join(process.cwd(), "config", "team-aliases.json");

let cachedIndex: Map<string, string> | null = null;

export async function loadTeamAliasIndex(): Promise<Map<string, string>> {
  if (cachedIndex) return cachedIndex;
  try {
    const raw = await readFile(ALIAS_PATH, "utf8");
    const parsed = JSON.parse(raw) as TeamAliasTable;
    cachedIndex = buildAliasIndex({
      aliases: {
        ...DEFAULT_TEAM_ALIASES.aliases,
        ...parsed.aliases,
      },
    });
  } catch {
    cachedIndex = buildAliasIndex(DEFAULT_TEAM_ALIASES);
  }
  return cachedIndex;
}

export async function normalizeTeamName(rawName: string): Promise<string> {
  const index = await loadTeamAliasIndex();
  return canonicalizeTeamName(rawName, index);
}
