import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

function readProjectFile(
  relativePath: string,
): string {
  return readFileSync(
    resolve(process.cwd(), relativePath),
    "utf8",
  );
}

function expectSource(
  source: string,
  fragment: string,
  message: string,
): void {
  if (!source.includes(fragment)) {
    throw new Error(message);
  }
}

const page = readProjectFile(
  "src/app/predictions/page.tsx",
);

const workspace = readProjectFile(
  "src/components/predictions-workspace.tsx",
);

const adminPage = readProjectFile(
  "src/app/admin/page.tsx",
);

const dictionary = readProjectFile(
  "src/i18n/dictionaries.ts",
);

expectSource(
  page,
  "await prisma.match.findMany",
  "Predictions page must load the complete fixture archive from PostgreSQL.",
);

expectSource(
  page,
  "year:\n            ACTIVE_SEASON_YEAR",
  "Complete fixtures must remain locked to ACTIVE_SEASON_YEAR.",
);

expectSource(
  page,
  "homeScore:\n          match.homeScore",
  "Historical home scores must be exposed to the fixture workspace.",
);

expectSource(
  page,
  "awayScore:\n          match.awayScore",
  "Historical away scores must be exposed to the fixture workspace.",
);

expectSource(
  page,
  "predictions.length === 0 &&\n      fixtures.length === 0",
  "All Matches must remain accessible when no recommendation is published.",
);

expectSource(
  workspace,
  '"ALL_FIXTURES"',
  "The All Matches view must be available.",
);

expectSource(
  workspace,
  "predictionByMatchId",
  "Fixtures must be matched with published predictions by immutable match id.",
);

expectSource(
  workspace,
  "No recommendation: this match was not published by Selection Policy V2.",
  "Non-published matches must explain why no recommendation is shown.",
);

expectSource(
  workspace,
  "fixture.homeScore !== null",
  "Finished fixtures must retain zero-value scores instead of using truthy checks.",
);

expectSource(
  adminPage,
  "process.env.API_FOOTBALL_KEY",
  "Admin API status must reflect whether the API key is configured.",
);

if (adminPage.includes("<strong>Free plan</strong>")) {
  throw new Error(
    "Admin must not display a hard-coded Free plan after a paid upgrade.",
  );
}

expectSource(
  dictionary,
  '{ en: "All Matches", tr: "Tüm Maçlar" }',
  "The new complete-fixture view must be available in Turkish.",
);

console.log(
  "Complete Fixture and Historical Results V4.8 tests passed.",
);
