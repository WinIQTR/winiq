import "dotenv/config";

import { access } from "node:fs/promises";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  const now = new Date();
  const [bookmakers, snapshots, pendingValueBets, settledValueBets] =
    await Promise.all([
      prisma.bookmaker.count({ where: { isActive: true } }),
      prisma.oddsSnapshot.count(),
      prisma.valueBetHistory.count({
        where: { result: "PENDING", kickoffAt: { gt: now } },
      }),
      prisma.valueBetHistory.count({
        where: { result: { in: ["WON", "LOST", "VOID"] } },
      }),
    ]);

  const snapshotPath = join(
    process.cwd(),
    "data",
    "value-bet-dashboard-snapshot.json",
  );
  let dashboardSnapshot = "MISSING";
  try {
    await access(snapshotPath);
    dashboardSnapshot = "READY";
  } catch {
    // The first production refresh creates the snapshot.
  }

  console.log("");
  console.log("==============================================");
  console.log("PRODUCTION V2 VERIFICATION");
  console.log("==============================================");
  console.table({
    "Active bookmakers": bookmakers,
    "Odds snapshots": snapshots,
    "Upcoming Value Bets": pendingValueBets,
    "Settled Value Bets": settledValueBets,
    "Value dashboard snapshot": dashboardSnapshot,
  });

  console.log("");
  console.log(
    snapshots === 0
      ? "V2 is installed. No bookmaker odds have been returned yet. V1 remains operational."
      : "V2 database and bookmaker odds history are ready.",
  );
}

main()
  .catch((error: unknown) => {
    console.error("V2 verification failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
