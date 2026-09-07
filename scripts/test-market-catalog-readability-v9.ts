import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const component = readFileSync(
  resolve(process.cwd(), "src/components/bet-market-catalog-panel.tsx"),
  "utf8",
);
const styles = readFileSync(
  resolve(process.cwd(), "src/components/predictions-workspace.module.css"),
  "utf8",
);

assert.match(component, /PAZAR/);
assert.match(component, /ÖNE ÇIKAN SEÇİM/);
assert.match(component, /PUAN/);
assert.match(styles, /\.marketGroupList\s*\{[\s\S]*?grid-template-columns: repeat\(2/);
assert.match(styles, /\.marketGroup > summary\s*\{[\s\S]*?grid-template-columns: 28px/);
assert.match(styles, /\.marketTitle b/);
assert.match(styles, /\.marketBestSelection strong/);
assert.match(styles, /@media \(max-width: 980px\)[\s\S]*?\.marketGroupList\s*\{\s*grid-template-columns: 1fr/);
assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.marketBestSelection\s*\{[\s\S]*?grid-row: 2/);

console.log("V9.3.6 readable 27-market catalog tests passed.");
