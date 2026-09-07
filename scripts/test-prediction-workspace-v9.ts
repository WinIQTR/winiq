import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  selectUpcomingFixtureWindow,
  type AllMatchesFixture,
} from "../src/lib/all-matches-fixtures";

const now = new Date("2026-09-04T12:00:00.000Z");
const baseFixture: AllMatchesFixture = {
  matchId: 1,
  kickoffAt: now,
  status: "SCHEDULED",
  leagueApiId: 39,
  leagueName: "Premier League",
  homeTeam: "Home",
  awayTeam: "Away",
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeScore: null,
  awayScore: null,
};

const futureFixtures = [
  { ...baseFixture, matchId: 1, kickoffAt: new Date("2026-09-10T12:00:00.000Z") },
  { ...baseFixture, matchId: 2, kickoffAt: new Date("2026-09-14T12:00:00.000Z") },
  { ...baseFixture, matchId: 3, kickoffAt: new Date("2026-09-22T12:00:00.000Z") },
  { ...baseFixture, matchId: 4, kickoffAt: new Date("2026-09-27T12:00:00.000Z") },
];

assert.deepEqual(
  selectUpcomingFixtureWindow(futureFixtures, 1, now).map((fixture) => fixture.matchId),
  [1],
  "The default one-week window must exclude later fixtures.",
);
assert.deepEqual(
  selectUpcomingFixtureWindow(futureFixtures, 2, now).map((fixture) => fixture.matchId),
  [1, 2],
  "The two-week option must extend the visible window.",
);
assert.deepEqual(
  selectUpcomingFixtureWindow(futureFixtures, 3, now).map((fixture) => fixture.matchId),
  [1, 2, 3],
  "The three-week option must extend the visible window without exceeding 21 days.",
);

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const workspace = read("src/components/predictions-workspace.tsx");
const workspaceStyles = read("src/components/predictions-workspace.module.css");
const expandableList = read("src/components/expandable-prediction-list.tsx");
const resultsPage = read("src/app/prediction-results/page.tsx");
const predictionsPage = read("src/app/predictions/page.tsx");
const sidebar = read("src/components/app-sidebar.tsx");
const evaluationPage = read("src/app/evaluation/page.tsx");
const evaluationStyles = read("src/app/evaluation/evaluation-page.module.css");

assert.match(workspace, /workspaceMode = "PREDICTIONS"/);
assert.match(workspace, /workspaceMode="FINISHED_RESULTS"|FINISHED_RESULTS/);
assert.match(workspace, /fixtureWindowWeeks/);
assert.match(workspace, /Önümüzdeki/);
assert.match(workspace, /\(\[1, 2, 3\] as const\)/);
assert.doesNotMatch(
  workspace.match(/workspaceMode === "PREDICTIONS"[\s\S]*?<\/section>/)?.[0] ?? "",
  /setWorkspaceView\("FINISHED"\)/,
  "The predictions page navigation must no longer expose Finished as a third tab.",
);
assert.match(workspaceStyles, /\.viewSwitchTwo/);
assert.match(workspaceStyles, /\.weekWindow/);
assert.match(workspaceStyles, /\.resultsSummary/);
assert.match(workspaceStyles, /\.finishedWorkspace/);
assert.match(workspaceStyles, /\.settlementWon/);
assert.match(workspace, /getSettlementLabel/);
assert.match(workspace, /Tüm pazar sonuçlarını incele/);

assert.match(expandableList, /BetMarketCatalogPanel/);
assert.match(expandableList, /Detaylı model analizini göster/);
assert.match(resultsPage, /workspaceMode="FINISHED_RESULTS"/);
assert.match(resultsPage, /Tahmin Sonuçları/);
assert.match(resultsPage, /status: "FINISHED"/);
assert.match(sidebar, /href: "\/prediction-results"/);
assert.match(predictionsPage, /kickoffAt:\s*\{\s*gt: pageLoadedAt/);
assert.match(predictionsPage, /in: \["SCHEDULED"\]/);

assert.match(evaluationPage, /compactPanelHeader/);
assert.match(evaluationPage, /marketAccuracy/);
assert.match(evaluationStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(evaluationStyles, /\.marketAccuracy/);

console.log("V9.3.2 prediction workspace separation and compact performance tests passed.");
