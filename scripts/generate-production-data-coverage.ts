import "dotenv/config";

import {
  generateProductionDataCoverageSnapshot,
} from "@/lib/production-data-coverage";

import {
  prisma,
} from "@/lib/prisma";

async function main(): Promise<void> {
  console.log(
    "\nV5.1 PRODUCTION DATA COVERAGE AND API QUOTA\n",
  );

  const snapshot =
    await generateProductionDataCoverageSnapshot();

  console.table({
    "Generated at":
      snapshot.generatedAt,
    Season:
      snapshot.seasonYear,
    "API status":
      snapshot.api.state,
    "API plan":
      snapshot.api.plan ?? "unknown",
    "API active":
      snapshot.api.active ?? "unknown",
    "Requests used":
      snapshot.api.usedToday ?? "unknown",
    "Daily limit":
      snapshot.api.dailyLimit ?? "unknown",
    "Requests remaining":
      snapshot.api.remainingToday ?? "unknown",
    Leagues:
      snapshot.totals.leagues,
    Fixtures:
      snapshot.totals.fixtures,
    Finished:
      snapshot.totals.finished,
    Scheduled:
      snapshot.totals.scheduled,
    "Missing final scores":
      snapshot.totals.missingFinalScores,
    "Published candidates":
      snapshot.totals.publishedCandidates,
    Champion:
      snapshot.production.champion,
    "Automatic model change":
      snapshot.production
        .automaticModelChangeAllowed
        ? "FAIL"
        : "LOCKED",
  });

  console.table(
    snapshot.leagues.map(
      (league) => ({
        League:
          league.leagueName,
        "API ID":
          league.leagueApiId,
        Fixtures:
          league.fixtures,
        Finished:
          league.finished,
        Scheduled:
          league.scheduled,
        "Missing scores":
          league.missingFinalScores,
        "Published candidates":
          league.publishedCandidates,
      }),
    ),
  );

  console.log(
    "Production data coverage snapshot generated.",
  );
  console.log(
    "No account identity, API key, database password, or model change was stored.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "\nProduction data coverage generation failed.",
    );
    console.error(
      error instanceof Error
        ? error.message
        : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
