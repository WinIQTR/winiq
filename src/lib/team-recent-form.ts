import { prisma } from "@/lib/prisma";

export type FormResult = "W" | "D" | "L";

export type TeamFormMaps = {
  overall: Map<number, FormResult[]>;
  home: Map<number, FormResult[]>;
  away: Map<number, FormResult[]>;
};

function pushResult(map: Map<number, FormResult[]>, teamId: number, result: FormResult) {
  const existing = map.get(teamId);
  if (existing) existing.push(result);
  else map.set(teamId, [result]);
}

function trimMaps(maps: TeamFormMaps, lastN: number) {
  for (const map of [maps.overall, maps.home, maps.away]) {
    for (const [teamId, results] of map) {
      map.set(teamId, results.slice(-lastN));
    }
  }
}

/**
 * One DB query → overall / home / away form strips (oldest→newest, trimmed to lastN).
 */
export async function buildTeamFormMaps(
  seasonYear: number,
  before: Date = new Date(),
  lastN = 5,
): Promise<TeamFormMaps> {
  const finishedMatches = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
      kickoffAt: { lt: before },
      season: { year: seasonYear },
    },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      kickoffAt: true,
    },
    orderBy: { kickoffAt: "asc" },
  });

  const maps: TeamFormMaps = {
    overall: new Map(),
    home: new Map(),
    away: new Map(),
  };

  for (const match of finishedMatches) {
    if (match.homeScore === null || match.awayScore === null) continue;

    let homeResult: FormResult;
    let awayResult: FormResult;
    if (match.homeScore > match.awayScore) {
      homeResult = "W";
      awayResult = "L";
    } else if (match.awayScore > match.homeScore) {
      homeResult = "L";
      awayResult = "W";
    } else {
      homeResult = "D";
      awayResult = "D";
    }

    pushResult(maps.overall, match.homeTeamId, homeResult);
    pushResult(maps.overall, match.awayTeamId, awayResult);
    pushResult(maps.home, match.homeTeamId, homeResult);
    pushResult(maps.away, match.awayTeamId, awayResult);
  }

  trimMaps(maps, lastN);
  return maps;
}

/**
 * Verilen sezon için tüm bitmiş maçları tek seferde çekip her takımın
 * son 5 maçtaki performansını (kronolojik sırayla) hesaplar.
 */
export async function buildTeamFormMap(
  seasonYear: number,
  before: Date = new Date(),
): Promise<Map<number, FormResult[]>> {
  const maps = await buildTeamFormMaps(seasonYear, before, 5);
  return maps.overall;
}
