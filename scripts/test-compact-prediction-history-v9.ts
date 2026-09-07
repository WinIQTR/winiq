import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const component = readFileSync(
  resolve(process.cwd(), "src/components/prediction-history-workspace.tsx"),
  "utf8",
);
const styles = readFileSync(
  resolve(process.cwd(), "src/components/prediction-history-workspace.module.css"),
  "utf8",
);

assert.match(component, /groupedMatches/);
assert.match(component, /Sonuçlanmış Tahminler/);
assert.match(component, /href="\/prediction-results"/);
assert.match(component, /27 PAZAR SONUÇLARI/);
assert.match(component, /Tüm bahis türleri/);
assert.match(component, /Detayı aç/);
assert.match(component, /formatSettlement/);
assert.doesNotMatch(component, /history-band-grid/);
assert.match(styles, /\.compactToolbar/);
assert.match(styles, /\.compactSummary/);
assert.match(styles, /min-height: 66px/);

console.log("V9.3.3 compact settled prediction history tests passed.");
