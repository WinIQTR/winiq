import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/prisma";

async function main() {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const archive = await readFile("src/lib/value-bet-archive.ts", "utf8");

  assert.match(schema, /model ValueBetHistory\s*\{/);
  assert.match(schema, /valueBetHistory\s+ValueBetHistory\[\]/);
  assert.equal("valueBetHistory" in prisma, true);
  assert.match(archive, /homeScore:\s*finalHomeScore/);
  assert.match(archive, /awayScore:\s*finalAwayScore/);

  console.log("Value Bet History Prisma Compatibility V6.1.1 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
