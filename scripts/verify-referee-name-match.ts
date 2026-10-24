import "dotenv/config";

import { ACTIVE_SEASON_YEAR } from "../src/config/season";
import {
  buildRefereeProfile,
  findRefereeNameForSlug,
  refereeNamesMatch,
  slugifyRefereeName,
} from "../src/lib/referee-profile";
import { prisma } from "../src/lib/prisma";

const pairs: Array<[string, string, boolean]> = [
  ["Samuel Barrott", "S. Barrott", true],
  ["Samuel Barrott, England", "S. Barrott", true],
  ["Chris Kavanagh", "C. Kavanagh", true],
  ["Michael Oliver", "M. Oliver", true],
  ["Jarred Gillett", "J. Gillett", true],
  ["H. U. Meler", "Halil Umut Meler", true],
  ["Robert Jones", "R. Jones", true],
  ["Robert Jones", "A. Jones", false],
  ["Andrea Calzavara", "A. Calzavara", true],
  ["Andrea Calzavara", "S. Barrott", false],
];

async function main() {
  const failures = pairs.filter(([a, b, expected]) => refereeNamesMatch(a, b) !== expected);
  if (failures.length) {
    console.error("match failures", failures);
    process.exit(1);
  }

  const finished = await prisma.match.findMany({
    where: { season: { year: ACTIVE_SEASON_YEAR }, status: "FINISHED", referee: { not: null } },
    orderBy: { kickoffAt: "desc" },
    take: 2_000,
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: { include: { league: { select: { name: true } } } },
      teamStatistics: { select: { yellowCards: true, redCards: true, fouls: true } },
    },
  });

  const names = [
    ...new Set(
      (
        await prisma.match.findMany({
          where: { season: { year: ACTIVE_SEASON_YEAR }, referee: { not: null } },
          select: { referee: true },
          distinct: ["referee"],
        })
      )
        .map((row) => row.referee?.trim())
        .filter(Boolean) as string[],
    ),
  ];

  const samples = ["Samuel Barrott", "Chris Kavanagh", "Andrea Calzavara", "M. Oliver"];
  const report = samples.map((name) => {
    const slug = slugifyRefereeName(name);
    const resolved = findRefereeNameForSlug(slug, names);
    const profile = buildRefereeProfile(name, finished);
    return {
      name,
      slug,
      resolved,
      matches: profile.matches,
      style: profile.styleLabel.tr,
      avgCards: profile.averageCards,
      recent: profile.recent.length,
    };
  });

  console.log(JSON.stringify({ ok: true, report }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
