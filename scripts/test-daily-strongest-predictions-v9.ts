import assert from "node:assert/strict";

import {
  selectTodaysStrongestPredictions,
} from "../src/lib/daily-strongest-predictions";

import {
  translateUiText,
} from "../src/i18n/dictionaries";

type TestPrediction = {
  id: string;
  kickoffAt: Date;
  productionScore: number;
};

const now = new Date("2026-08-27T21:30:00.000Z");

const predictions: TestPrediction[] = [
  { id: "yesterday", kickoffAt: new Date("2026-08-27T18:00:00.000Z"), productionScore: 100 },
  { id: "late", kickoffAt: new Date("2026-08-28T18:00:00.000Z"), productionScore: 92 },
  { id: "early", kickoffAt: new Date("2026-08-28T09:00:00.000Z"), productionScore: 88 },
  { id: "middle", kickoffAt: new Date("2026-08-28T14:00:00.000Z"), productionScore: 95 },
  { id: "weaker", kickoffAt: new Date("2026-08-28T08:00:00.000Z"), productionScore: 60 },
  { id: "tomorrow", kickoffAt: new Date("2026-08-28T21:00:00.000Z"), productionScore: 100 },
];

const selected = selectTodaysStrongestPredictions(predictions, now, 3);

assert.deepEqual(
  selected.map((prediction) => prediction.id),
  ["early", "middle", "late"],
  "The strongest three Istanbul-today fixtures must be shown in kickoff order.",
);

assert.deepEqual(
  selectTodaysStrongestPredictions(predictions, now, 0),
  [],
  "A non-positive display limit must return an empty list.",
);

assert.equal(
  translateUiText("Today's Strongest Fixtures", "tr"),
  "Günün En Güçlü Maçları",
);

assert.equal(
  translateUiText(
    "Today in Türkiye time, ordered by kickoff. HOME outcome only, at least 45% probability, HIGH/VERY HIGH reliability, and 45+ data quality.",
    "tr",
  ),
  "Türkiye saatine göre bugünün maçları; başlangıç saatine göre sıralanır. Yalnız ev sahibi sonucu; en az %45 olasılık, yüksek/çok yüksek güvenilirlik ve 45+ veri kalitesi.",
);

console.log("V9.2.1 daily strongest predictions tests passed.");
