import {
  ACTIVE_COMPETITIONS,
  getDomesticCompetitions,
  getEuropeanCompetitions,
} from "@/config/competitions";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "TARGET COMPETITIONS TEST",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) => ({
        priority:
          competition.priority,

        apiId:
          competition.apiId,

        competition:
          competition.name,

        shortName:
          competition.shortName,

        country:
          competition.country ??
          "EUROPE",

        kind:
          competition.kind,
      }),
    ),
  );

  console.log("");

  console.table({
    "Total":
      ACTIVE_COMPETITIONS.length,

    "Domestic":
      getDomesticCompetitions()
        .length,

    "Europe":
      getEuropeanCompetitions()
        .length,
  });
}

main().catch(
  (
    error: unknown,
  ) => {
    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode =
      1;
  },
);