import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(
  resolve(process.cwd(), "src/app/evaluation/page.tsx"),
  "utf8",
);
const styles = readFileSync(
  resolve(process.cwd(), "src/app/evaluation/evaluation-page.module.css"),
  "utf8",
);

assert.match(page, /Akıllı Tahmin Performansı/);
assert.match(page, /MODEL SAĞLIĞI/);
assert.match(page, /EN BAŞARILI BAHİS TÜRÜ/);
assert.match(page, /KALİBRASYON FARKI/);
assert.match(page, /YÜKSEK GÜVEN ETKİSİ/);
assert.match(page, /BAHİS TÜRÜNE GÖRE PERFORMANS/);
assert.match(page, /OLASILIK KALİBRASYONU/);
assert.match(page, /summary\.settledPredictions < 30/);
assert.match(page, /formatMarketName/);
assert.match(styles, /\.accuracyRing/);
assert.match(styles, /conic-gradient/);
assert.match(styles, /\.insightGrid/);
assert.match(styles, /\.confidenceBar/);
assert.match(styles, /@media \(max-width: 700px\)/);

console.log("V9.3.4 smart evaluation page tests passed.");
