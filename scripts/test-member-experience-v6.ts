import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const memberPage = await readFile("src/app/member/page.tsx", "utf8");

  assert.match(memberPage, /prisma\.smartPickHistory\.findMany/);
  assert.match(memberPage, /result: \{ in: \["WON", "LOST", "VOID"\] \}/);
  assert.match(memberPage, /take: 30/);
  assert.match(memberPage, /translateSelectionLabel/);
  assert.match(memberPage, /Ev sahibi takım golü/);
  assert.match(memberPage, /Deplasman takım golü/);
  assert.match(memberPage, /Toplam gol/);
  assert.match(memberPage, /Karşılıklı gol/);
  assert.match(memberPage, /Kazandı/);
  assert.match(memberPage, /Kaybetti/);
  assert.match(memberPage, /İade/);
  assert.match(memberPage, /user\.plan !== "BASIC"/);
  assert.match(memberPage, /user\.plan === "PROFESSIONAL"/);
  assert.doesNotMatch(memberPage, />Predictions</);
  assert.doesNotMatch(memberPage, />0 Result</);

  console.log("Member Experience and Persistent History V6.3 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
