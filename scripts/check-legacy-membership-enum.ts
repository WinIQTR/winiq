/**
 * Blok F hygiene: refuse enum drop until no MEMBER rows use BASIC/ANALYSIS.
 * Run after prod normalize-single-membership.
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";

async function main() {
  const legacy = await prisma.appUser.count({
    where: {
      role: "MEMBER",
      plan: { in: ["BASIC", "ANALYSIS"] },
    },
  });
  const prices = await prisma.membershipPlanPrice.count({
    where: { plan: { in: ["BASIC", "ANALYSIS"] }, isActive: true },
  });

  const ready = legacy === 0 && prices === 0;
  console.log(
    JSON.stringify(
      {
        ok: ready,
        legacyMembers: legacy,
        activeLegacyPrices: prices,
        next: ready
          ? "Safe to plan Prisma enum migration (ops)."
          : "Run: npx tsx scripts/normalize-single-membership.ts",
      },
      null,
      2,
    ),
  );
  if (!ready) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
