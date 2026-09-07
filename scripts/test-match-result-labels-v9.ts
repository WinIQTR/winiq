import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const card = readFileSync(
  resolve(process.cwd(), "src/components/prediction-card.tsx"),
  "utf8",
);
const detail = readFileSync(
  resolve(process.cwd(), "src/components/prediction-detail-panel.tsx"),
  "utf8",
);
const globals = readFileSync(
  resolve(process.cwd(), "src/app/globals.css"),
  "utf8",
);

assert.match(card, /MAÇ SONUCU OLASILIKLARI/);
assert.match(card, /MS 1 · EV SAHİBİ/);
assert.match(card, /MS 0 · BERABERLİK/);
assert.match(card, /MS 2 · DEPLASMAN/);
assert.match(detail, /Maç Sonucu Olasılıkları · 1X2/);
assert.match(detail, /MS 1 · Ev Sahibi/);
assert.match(detail, /MS 0 · Beraberlik/);
assert.match(detail, /MS 2 · Deplasman/);
assert.match(globals, /\.prediction-outcomes-header/);

console.log("V9.3.5 match-result category label tests passed.");
