/**
 * External open-data Brier benchmark (CC BY — attribute Football Analytics when using their CSV).
 * Joins overlapping fixtures by fuzzy team+kickoff or explicit fixture id map.
 */

import { multiClassBrier } from "@/modules/prediction-audit/scoring";
import type {
  OneXTwoResult,
  SettledOneXTwoRow,
} from "@/modules/prediction-audit/types";

export type ExternalBenchmarkMatch = {
  fixtureId: string;
  ourBrier: number;
  theirBrier: number;
  ourPickCorrect: boolean;
  theirPickCorrect: boolean;
  leagueKey: string;
};

export type ExternalBenchmarkReport = {
  attribution: string;
  overlapped: number;
  ourMeanBrier: number | null;
  theirMeanBrier: number | null;
  ourHitRate: number | null;
  theirHitRate: number | null;
  /** Positive = we have lower (better) Brier. */
  brierAdvantage: number | null;
  matches: ExternalBenchmarkMatch[];
};

function keyOf(row: SettledOneXTwoRow): string {
  const day = row.kickoffAt.toISOString().slice(0, 10);
  return `${day}|${norm(row.homeTeam)}|${norm(row.awayTeam)}`;
}

function norm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function compareToExternalOpenData(
  ours: readonly SettledOneXTwoRow[],
  theirs: readonly SettledOneXTwoRow[],
  options?: {
    attribution?: string;
  },
): ExternalBenchmarkReport {
  const theirByKey = new Map<string, SettledOneXTwoRow>();
  for (const row of theirs) {
    if (row.result === null) continue;
    theirByKey.set(keyOf(row), row);
    theirByKey.set(row.fixtureId, row);
  }

  const matches: ExternalBenchmarkMatch[] = [];
  for (const row of ours) {
    if (row.result === null) continue;
    const other =
      theirByKey.get(row.fixtureId) ?? theirByKey.get(keyOf(row));
    if (!other || other.result === null) continue;
    matches.push({
      fixtureId: row.fixtureId,
      ourBrier: multiClassBrier(
        row.pHome,
        row.pDraw,
        row.pAway,
        row.result,
      ),
      theirBrier: multiClassBrier(
        other.pHome,
        other.pDraw,
        other.pAway,
        other.result,
      ),
      ourPickCorrect: row.pick === row.result,
      theirPickCorrect: other.pick === other.result,
      leagueKey: row.leagueKey,
    });
  }

  if (matches.length === 0) {
    return {
      attribution:
        options?.attribution ??
        "Football Analytics open data (CC BY 4.0) — https://footballanalytics.pro/data",
      overlapped: 0,
      ourMeanBrier: null,
      theirMeanBrier: null,
      ourHitRate: null,
      theirHitRate: null,
      brierAdvantage: null,
      matches: [],
    };
  }

  const ourMeanBrier =
    matches.reduce((total, row) => total + row.ourBrier, 0) / matches.length;
  const theirMeanBrier =
    matches.reduce((total, row) => total + row.theirBrier, 0) /
    matches.length;

  return {
    attribution:
      options?.attribution ??
      "Football Analytics open data (CC BY 4.0) — https://footballanalytics.pro/data",
    overlapped: matches.length,
    ourMeanBrier,
    theirMeanBrier,
    ourHitRate:
      matches.filter((row) => row.ourPickCorrect).length / matches.length,
    theirHitRate:
      matches.filter((row) => row.theirPickCorrect).length / matches.length,
    brierAdvantage: theirMeanBrier - ourMeanBrier,
    matches,
  };
}

/** Minimal CSV parser for the open-data all.csv shape (header-required). */
export function parseOpenDataSettledCsv(text: string): SettledOneXTwoRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!);
  const idx = (name: string) => header.indexOf(name);
  const iFixture = idx("fixture_id");
  const iKick = idx("kickoff_utc");
  const iLeague = idx("league");
  const iSlug = idx("league_slug");
  const iCountry = idx("country");
  const iHome = idx("home_team");
  const iAway = idx("away_team");
  const iHs = idx("home_score");
  const iAs = idx("away_score");
  const iResult = idx("result");
  const iPh = idx("p_home");
  const iPd = idx("p_draw");
  const iPa = idx("p_away");
  const iLh = idx("lambda_home");
  const iLa = idx("lambda_away");
  const iPick = idx("pick");
  const iCorrect = idx("pick_correct");
  const iModel = idx("model_version");
  if (
    [iFixture, iKick, iPh, iPd, iPa, iPick, iResult].some((value) => value < 0)
  ) {
    throw new Error("unexpected open-data columns");
  }

  const rows: SettledOneXTwoRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cols = splitCsvLine(lines[lineIndex]!);
    if (!cols[iFixture]) continue;
    const result = cols[iResult] as OneXTwoResult;
    const pick = cols[iPick] as OneXTwoResult;
    rows.push({
      fixtureId: cols[iFixture]!,
      kickoffAt: new Date(cols[iKick]!),
      leagueKey: iSlug >= 0 ? cols[iSlug]! : "unknown",
      leagueName: iLeague >= 0 ? cols[iLeague]! : "Unknown",
      country: iCountry >= 0 ? cols[iCountry]! : null,
      homeTeam: iHome >= 0 ? cols[iHome]! : "",
      awayTeam: iAway >= 0 ? cols[iAway]! : "",
      homeScore: iHs >= 0 && cols[iHs] !== "" ? Number(cols[iHs]) : null,
      awayScore: iAs >= 0 && cols[iAs] !== "" ? Number(cols[iAs]) : null,
      result: result === "1" || result === "X" || result === "2" ? result : null,
      pHome: Number(cols[iPh]),
      pDraw: Number(cols[iPd]),
      pAway: Number(cols[iPa]),
      lambdaHome: iLh >= 0 && cols[iLh] !== "" ? Number(cols[iLh]) : null,
      lambdaAway: iLa >= 0 && cols[iLa] !== "" ? Number(cols[iLa]) : null,
      pick,
      pickCorrect:
        iCorrect >= 0 && cols[iCorrect] !== ""
          ? cols[iCorrect] === "1"
          : null,
      modelVersion: iModel >= 0 ? cols[iModel]! : "external",
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
