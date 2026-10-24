import "dotenv/config";

import { translateUiText } from "../src/i18n/dictionaries";
import { buildMatchFormTip } from "../src/lib/member-match-insight";
import { buildTeamFormMaps } from "../src/lib/team-recent-form";
import { ACTIVE_SEASON_YEAR } from "../src/config/season";
import { prisma } from "../src/lib/prisma";

async function main() {
  const maps = await buildTeamFormMaps(ACTIVE_SEASON_YEAR);
  const upcoming = await prisma.match.findMany({
    where: {
      season: { year: ACTIVE_SEASON_YEAR },
      kickoffAt: { gte: new Date() },
      status: { in: ["SCHEDULED", "LIVE"] },
    },
    take: 12,
    orderBy: { kickoffAt: "asc" },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  const t = (source: string) => translateUiText(source, "tr");
  const tips = upcoming.map((match) => {
    const tip = buildMatchFormTip(
      {
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeRecentResults: maps.overall.get(match.homeTeam.id),
        awayRecentResults: maps.overall.get(match.awayTeam.id),
        homeVenueResults: maps.home.get(match.homeTeam.id),
        awayVenueResults: maps.away.get(match.awayTeam.id),
      },
      t,
    );
    return {
      match: `${match.homeTeam.name} – ${match.awayTeam.name}`,
      tip,
    };
  });

  const standingCount = await prisma.leagueStanding.count();
  const eventCount = await prisma.matchEvent.count();
  const leaderCount = await prisma.playerLeaderboardEntry.count();
  const teamStatCount = await prisma.teamSeasonApiStatistic.count();

  console.log(
    JSON.stringify(
      {
        tipsWithSignal: tips.filter((row) => row.tip).length,
        sampleTips: tips.filter((row) => row.tip).slice(0, 6),
        caches: { standingCount, eventCount, leaderCount, teamStatCount },
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
