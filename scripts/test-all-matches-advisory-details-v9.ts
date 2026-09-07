import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function main(): void {
  const component = read("src/components/predictions-workspace.tsx");
  const styles = read("src/components/predictions-workspace.module.css");
  const packageJson = read("package.json");

  assert.match(component, /buildAdvisoryBetOptions/);
  assert.match(component, /Öne çıkan seçenekleri ve nedenleri göster/);
  assert.match(component, /DİKKATLİ İNCELE • ÖNERİ DEĞİL/);
  assert.match(component, /resmî bahis önerisi değildir/);
  assert.match(component, /Neden önerilmedi\?/);
  assert.match(component, /yeterli olasılık ve xG verisi bulunmadığından/);
  assert.match(component, /getAdvisoryMarketLabel/);
  assert.match(component, /getAdvisorySelectionLabel/);

  // V9/V9.1 UI additions must survive the V6.8.1 feature merge.
  assert.match(component, /homeForm/);
  assert.match(component, /awayForm/);
  assert.match(component, /fixtureArchiveDivider/);
  assert.match(component, /next\/image/);

  assert.match(styles, /\.advisoryBetDetails/);
  assert.match(styles, /\.advisoryBetGrid/);
  assert.match(styles, /\.advisoryPanelWarning/);
  assert.match(styles, /\.rejectionSection/);
  assert.match(styles, /\.formIcons/);
  assert.match(styles, /\.fixtureArchiveDivider/);
  assert.match(packageJson, /test:advisory-details-v9/);

  console.log("V9.2 Cloud-Compatible All Matches Advisory Details tests passed.");
}

main();
