import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  mergeFixturesWithPublishedPredictions,
  selectAndSortAllMatches,
  selectAndSortFinishedMatches,
  type AllMatchesFixture,
} from "../src/lib/all-matches-fixtures";

import type {
  DashboardPrediction,
} from "../src/lib/prediction-dashboard-shared";

const fixture: AllMatchesFixture = {
  matchId: 1,
  kickoffAt: new Date("2026-08-27T17:00:00.000Z"),
  status: "NOT_STARTED",
  leagueApiId: 39,
  leagueName: "Premier League",
  homeTeam: "Existing Home",
  awayTeam: "Existing Away",
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeScore: null,
  awayScore: null,
};

const prediction = (matchId: number): DashboardPrediction => ({
  matchId,
  kickoffAt: new Date("2026-08-27T19:00:00.000Z"),
  leagueApiId: 140,
  leagueName: "La Liga",
  homeTeam: "Published Home",
  awayTeam: "Published Away",
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeRecentResults: ["W", "D"],
  awayRecentResults: ["L", "D"],
  finalHomeScore: null,
  finalAwayScore: null,
} as DashboardPrediction);

const merged = mergeFixturesWithPublishedPredictions(
  [fixture],
  [prediction(1), prediction(2)],
);

assert.equal(merged.length, 2, "Existing fixtures must not be duplicated.");
assert.equal(
  merged.find((item) => item.matchId === 1)?.homeTeam,
  "Existing Home",
  "The fixture archive must remain authoritative for existing matches.",
);
assert.deepEqual(
  merged.find((item) => item.matchId === 2)?.homeForm,
  ["W", "D"],
  "A missing published fixture must be synthesized with prediction form data.",
);

const finishedRows: AllMatchesFixture[] = [
  {
    ...fixture,
    matchId: 20,
    kickoffAt: new Date("2026-08-20T17:00:00.000Z"),
    homeScore: 2,
    awayScore: 1,
  },
  {
    ...fixture,
    matchId: 21,
    kickoffAt: new Date("2026-08-24T17:00:00.000Z"),
    status: "FINISHED",
  },
  {
    ...fixture,
    matchId: 22,
    kickoffAt: new Date("2026-08-26T17:00:00.000Z"),
  },
];

assert.deepEqual(
  selectAndSortFinishedMatches(
    finishedRows,
    new Set([20]),
    "ALL",
  ).map((item) => item.matchId),
  [20, 21],
  "Finished Matches must exclude upcoming fixtures and keep published recommendations first.",
);

const crossDateFixtures: AllMatchesFixture[] = [
  {
    ...fixture,
    matchId: 10,
    kickoffAt: new Date("2026-09-10T17:00:00.000Z"),
  },
  {
    ...fixture,
    matchId: 11,
    kickoffAt: new Date("2026-08-20T17:00:00.000Z"),
  },
  {
    ...fixture,
    matchId: 12,
    kickoffAt: new Date("2026-10-01T17:00:00.000Z"),
  },
];

assert.deepEqual(
  selectAndSortAllMatches(
    crossDateFixtures,
    new Set([12]),
    "ALL",
    new Date("2026-08-01T00:00:00.000Z"),
  ).map((item) => item.matchId),
  [12, 11, 10],
  "All dates must remain visible, with recommendations first and each group chronological.",
);

const statusSeparatedRows: AllMatchesFixture[] = [
  {
    ...fixture,
    matchId: 30,
    status: "SCHEDULED",
    kickoffAt: new Date("2026-09-01T17:00:00.000Z"),
  },
  {
    ...fixture,
    matchId: 31,
    status: "SCHEDULED",
    kickoffAt: new Date("2026-07-01T17:00:00.000Z"),
  },
  {
    ...fixture,
    matchId: 32,
    status: "FINISHED",
    kickoffAt: new Date("2026-07-02T17:00:00.000Z"),
  },
  {
    ...fixture,
    matchId: 33,
    status: "LIVE",
    kickoffAt: new Date("2026-09-02T17:00:00.000Z"),
  },
  {
    ...fixture,
    matchId: 34,
    status: "POSTPONED",
    kickoffAt: new Date("2026-09-03T17:00:00.000Z"),
  },
];

assert.deepEqual(
  selectAndSortAllMatches(
    statusSeparatedRows,
    new Set(),
    "ALL",
    new Date("2026-08-27T00:00:00.000Z"),
  ).map((item) => item.matchId),
  [30],
  "All Matches must contain only future SCHEDULED fixtures without scores.",
);

const component = readFileSync(
  resolve(process.cwd(), "src/components/predictions-workspace.tsx"),
  "utf8",
);
const styles = readFileSync(
  resolve(process.cwd(), "src/components/predictions-workspace.module.css"),
  "utf8",
);
const page = readFileSync(
  resolve(process.cwd(), "src/app/predictions/page.tsx"),
  "utf8",
);
const pageStyles = readFileSync(
  resolve(process.cwd(), "src/app/predictions/predictions-page.module.css"),
  "utf8",
);

assert.match(component, /mergeFixturesWithPublishedPredictions/);
assert.match(component, /selectAndSortAllMatches/);
assert.match(component, /selectAndSortFinishedMatches/);
assert.match(component, /allUpcomingFixtures/);
assert.match(component, /allFinishedFixtures/);
assert.match(component, /teamSearch/);
assert.match(component, /Takım ara/);
assert.match(component, /Filtreleri temizle/);
assert.match(component, /smartToolbar/);
assert.match(component, /27 bahis pazarını ve puanları göster/);
assert.match(component, /BetMarketCatalogPanel/);
assert.match(component, /calculatedMarketCount/);
assert.match(component, /FİLTRELERİ GEÇTİ/);
assert.match(component, /publishedPrediction\.topPicks\.slice\(0, 5\)/);
assert.match(component, /styles\.fixtureCardPublished\s*:\s*styles\.fixtureCardAdvisory/);
assert.match(styles, /\.fixtureCardPublished/);
assert.match(styles, /\.fixtureCardAdvisory/);
assert.match(styles, /\.publishedBetDetails/);
assert.match(styles, /\.publishedBetGrid/);
assert.match(styles, /\.publishedPanelSuccess/);
assert.match(styles, /grid-template-columns: minmax\(135px, 0\.55fr\)/);
assert.match(styles, /\.publishedBetDetails\[open\]/);
assert.match(styles, /\.advisoryBetDetails\[open\]/);
assert.match(styles, /width: min\(100%, 720px\)/);
assert.match(styles, /\.viewButtonActive span/);
assert.match(styles, /\.searchField/);
assert.match(styles, /\.leagueSelect/);
assert.match(styles, /\.toolbarSummary/);
assert.match(styles, /\.marketCatalog/);
assert.match(styles, /\.marketGroupStrong/);
assert.match(styles, /\.marketGroupMedium/);
assert.match(styles, /\.marketGroupWeak/);
assert.match(styles, /\.fullWidthMarketDetails/);
assert.match(styles, /grid-column: 1 \/ -1/);
assert.match(styles, /Eski sağ-sütun panelleri yerine tek tam-genişlik panel/);
assert.match(page, /SMART MATCH CENTER/);
assert.match(page, /Explore Matches/);
assert.match(pageStyles, /\.predictionsTopbar/);
assert.match(pageStyles, /\.matchCenter/);

console.log("V9.2.6 upcoming and finished separation tests passed.");
