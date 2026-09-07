import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const component = await readFile("src/components/prediction-history-workspace.tsx", "utf8");
  const styles = await readFile("src/components/prediction-history-workspace.module.css", "utf8");

  assert.match(component, /const groupedMatches = useMemo/);
  assert.match(component, /new Map<number, HistoryPrediction\[]>/);
  assert.match(component, /<details className=\{styles\.matchGroup\}/);
  assert.match(component, /<summary className=\{styles\.matchSummary\}>/);
  assert.match(component, /group\.rows\.map/);
  assert.match(component, /Show details/);
  assert.match(component, /Hide details/);
  assert.match(component, /group\.won/);
  assert.match(component, /group\.lost/);
  assert.doesNotMatch(component, /filteredPredictions\.map\(\(prediction\) => \(/);
  assert.match(styles, /\.matchGroup\[open\]/);
  assert.match(styles, /\.detailPanel/);
  assert.match(styles, /\.detailRow/);

  console.log("Grouped Match Evaluation Accordion V6.5 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
