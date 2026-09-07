import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function source(path: string): Promise<string> {
  return readFile(
    join(process.cwd(), ...path.split("/")),
    "utf8",
  );
}

function requirePattern(
  content: string,
  pattern: RegExp,
  message: string,
): void {
  assert.match(content, pattern, message);
}

function rejectPattern(
  content: string,
  pattern: RegExp,
  message: string,
): void {
  assert.doesNotMatch(content, pattern, message);
}

async function main(): Promise<void> {
  const [
    season,
    home,
    predictions,
    fixtures,
    teams,
    players,
    admin,
    settings,
    evaluationPage,
    predictionEvaluation,
    smartPicks,
    valueBetsPage,
    valueBetArchive,
    evaluationApi,
  ] = await Promise.all([
    source("src/config/season.ts"),
    source("src/app/page.tsx"),
    source("src/app/predictions/page.tsx"),
    source("src/app/fixtures/page.tsx"),
    source("src/app/teams/page.tsx"),
    source("src/app/players/page.tsx"),
    source("src/app/admin/page.tsx"),
    source("src/app/settings/page.tsx"),
    source("src/app/evaluation/page.tsx"),
    source("src/lib/prediction-evaluation.ts"),
    source("src/app/smart-picks/page.tsx"),
    source("src/app/value-bets/page.tsx"),
    source("src/lib/value-bet-archive.ts"),
    source("src/app/api/evaluation/route.ts"),
  ]);

  requirePattern(
    season,
    /DEFAULT_ACTIVE_SEASON\s*=\s*2026/,
    "The live season default must be 2026.",
  );

  requirePattern(
    season,
    /ACTIVE_SEASON_LABEL/,
    "The public 2026/27 label is missing.",
  );

  for (const [name, content] of [
    ["Dashboard", home],
    ["Predictions", predictions],
    ["Fixtures", fixtures],
    ["Teams", teams],
    ["Players", players],
  ] as const) {
    requirePattern(
      content,
      /ACTIVE_SEASON_YEAR/,
      `${name} must use ACTIVE_SEASON_YEAR.`,
    );
  }

  for (const [name, content] of [
    ["Dashboard snapshot", home],
    ["Predictions snapshot", predictions],
    ["Value Bet snapshot", valueBetsPage],
  ] as const) {
    requirePattern(
      content,
      /isDateInSeason/,
      `${name} must reject rows outside the active season.`,
    );
  }

  rejectPattern(
    admin,
    /2024 TEST MODU|defaultValue="2024"/,
    "Admin still presents 2024 as the live season.",
  );

  requirePattern(
    admin,
    /ACTIVE_SEASON_LABEL/,
    "Admin does not display the active season label.",
  );

  rejectPattern(
    settings,
    /defaultValue="2024"|2024 Test/,
    "Settings still defaults to the 2024 test season.",
  );

  requirePattern(
    settings,
    /ACTIVE_SEASON_YEAR/,
    "Settings does not use the active season.",
  );

  requirePattern(
    evaluationPage,
    /evaluatePredictions\([\s\S]*?500,[\s\S]*?ACTIVE_SEASON_YEAR/,
    "Production evaluation must request only the active season.",
  );

  requirePattern(
    predictionEvaluation,
    /seasonYear\?: number/,
    "Prediction evaluation does not expose a season filter.",
  );

  requirePattern(
    predictionEvaluation,
    /year: seasonYear/,
    "Prediction evaluation does not apply its season filter.",
  );

  requirePattern(
    smartPicks,
    /HISTORICAL_MODEL_SEASON_LABEL/,
    "Smart Picks must be labelled as historical validation.",
  );

  requirePattern(
    valueBetsPage,
    /ACTIVE_SEASON_LABEL/,
    "Value Bets does not display the active season.",
  );

  const valueBetSeasonFilters =
    valueBetArchive.match(/year: ACTIVE_SEASON_YEAR/g)?.length ?? 0;

  assert.ok(
    valueBetSeasonFilters >= 4,
    "Value Bet publication, settlement, upcoming and history must all be season-filtered.",
  );

  requirePattern(
    evaluationApi,
    /HISTORICAL_MODEL_SEASON_YEAR/,
    "The learning evaluation API must explicitly use historical data.",
  );

  requirePattern(
    evaluationApi,
    /HISTORICAL_MODEL_VALIDATION/,
    "The learning evaluation API must identify its historical data role.",
  );

  console.log(
    "Application-wide 2026 Season Consistency V4.7 tests passed.",
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  process.exitCode = 1;
});
