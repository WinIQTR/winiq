import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function source(file: string): Promise<string> {
  return readFile(path.join(process.cwd(), file), "utf8");
}

async function main(): Promise<void> {
  const [fixtures, teams, players, smart, css, layout] = await Promise.all([
    source("src/app/fixtures/page.tsx"), source("src/app/teams/page.tsx"),
    source("src/app/players/page.tsx"), source("src/app/smart-picks/page.tsx"),
    source("src/app/v6-8-ui.css"), source("src/app/layout.tsx"),
  ]);

assert.match(fixtures, /ACTIVE_COMPETITIONS/);
assert.match(fixtures, /fixtures-week-grid/);
assert.match(fixtures, /LİDER/);
assert.match(teams, /standingsScope/);
assert.match(teams, /İç saha/);
assert.match(players, /seasonStatistics/);
assert.match(players, /İDEAL 11/);
assert.match(players, /Sonradan/);
assert.match(smart, /historyGroups/);
assert.match(smart, /smart-history-match/);
assert.match(css, /dashboard-metrics/);
assert.match(css, /comparison-value-good/);
assert.match(layout, /v6-8-ui\.css/);

  console.log("V6.8 Dashboard, Fixture, Team, Player and Membership Experience tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
