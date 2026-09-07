import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildBetMarketCatalog,
  settleBetMarketOption,
} from "../src/lib/bet-market-catalog";

const catalog = buildBetMarketCatalog({
  matchId: 9001,
  homeTeam: "Ev Takımı",
  awayTeam: "Deplasman Takımı",
  homeProbability: 58,
  drawProbability: 25,
  awayProbability: 17,
  expectedHomeGoals: 2.1,
  expectedAwayGoals: 0.8,
  confidenceScore: 78,
  dataQualityScore: 72,
  locale: "tr",
  knownMarkets: [
    {
      label: "Korner Alt/Üst",
      supported: true,
      market: "Toplam Korner 9.5",
      selection: "OVER",
      probability: 64,
      fairOdds: 1.56,
    },
    {
      label: "Kart Bahisleri",
      supported: true,
      market: "Toplam Kart 4.5",
      selection: "UNDER",
      probability: 59,
      fairOdds: 1.69,
    },
  ],
});

assert.equal(catalog.length, 27, "The catalog must always contain all 27 market groups.");
assert.deepEqual(
  catalog.map((market) => market.number),
  Array.from({ length: 27 }, (_, index) => index + 1),
  "Market groups must preserve the requested 1-27 order.",
);

const matchResult = catalog[0]!;
assert.equal(matchResult.available, true);
assert.equal(matchResult.options.length, 3);
assert.equal(matchResult.options[0]?.selection, "MS 1 • Ev Takımı");

const totalGoals = catalog[4]!;
assert.equal(totalGoals.available, true);
assert.equal(totalGoals.options.length, 12, "All six total-goal lines need both sides.");

const halfTime = catalog[2]!;
assert.equal(halfTime.options.every((option) => option.estimated), true);

const corners = catalog[20]!;
assert.equal(corners.available, true, "Known corner data must activate the corner group.");

const offsides = catalog[22]!;
assert.equal(offsides.available, false, "Missing event data must never create fake offside picks.");
assert.match(offsides.reason ?? "", /maç olayı/i);

const allOptions = catalog.flatMap((market) => market.options);
assert.equal(allOptions.length > 50, true, "The expanded catalog must expose the detailed alternatives.");
assert.equal(
  allOptions.every((option) =>
    option.score >= 0 &&
    option.score <= 100 &&
    option.probability > 0 &&
    option.probability < 100 &&
    option.fairOdds > 1,
  ),
  true,
  "Every calculated option must have bounded score, probability and fair odds.",
);

assert.equal(settleBetMarketOption("ms-1", 3, 1), "WON");
assert.equal(settleBetMarketOption("dc-02", 3, 1), "LOST");
assert.equal(settleBetMarketOption("tg-2.5-ust", 2, 1), "WON");
assert.equal(settleBetMarketOption("EV-1.5-ust", 2, 0), "WON");
assert.equal(settleBetMarketOption("MS-var", 2, 0), "LOST");
assert.equal(settleBetMarketOption("MS 1-25-alt", 1, 0), "WON");
assert.equal(settleBetMarketOption("25-ÜST-YOK", 3, 0), "WON");
assert.equal(settleBetMarketOption("score-2-2", 2, 2), "WON");
assert.equal(settleBetMarketOption("dnb-home", 1, 1), "VOID");
assert.equal(settleBetMarketOption("iy-1", 3, 1), "DATA_MISSING");
assert.equal(settleBetMarketOption("known:Toplam Korner", 3, 1), "DATA_MISSING");
assert.equal(
  new Set(allOptions.map((option) => option.tier)).size >= 2,
  true,
  "The example must produce multiple recommendation colors.",
);

const emptyCatalog = buildBetMarketCatalog({
  matchId: 9002,
  homeTeam: "A",
  awayTeam: "B",
  homeProbability: null,
  drawProbability: null,
  awayProbability: null,
  expectedHomeGoals: null,
  expectedAwayGoals: null,
  confidenceScore: null,
  locale: "tr",
});

assert.equal(emptyCatalog.length, 27);
assert.equal(
  emptyCatalog.every((market) => !market.available),
  true,
  "Missing match data must produce transparent waiting states instead of invented predictions.",
);

const reusablePanel = readFileSync(
  resolve(process.cwd(), "src/components/bet-market-catalog-panel.tsx"),
  "utf8",
);
const expandableList = readFileSync(
  resolve(process.cwd(), "src/components/expandable-prediction-list.tsx"),
  "utf8",
);

assert.match(reusablePanel, /export function BetMarketCatalogPanel/);
assert.match(reusablePanel, /finalHomeScore/);
assert.match(reusablePanel, /KAZANDI/);
assert.match(reusablePanel, /VERİ YOK/);
assert.match(expandableList, /buildBetMarketCatalog/);
assert.match(expandableList, /BetMarketCatalogPanel/);
assert.match(expandableList, /marketCatalogArea/);

console.log("V9.3 27-market scored catalog tests passed.");
