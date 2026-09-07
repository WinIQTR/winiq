import { prisma } from "@/lib/prisma";

export type FormResult = "W" | "D" | "L";

/**
 * Verilen sezon için tüm bitmiş maçları tek seferde çekip her takımın
 * son 5 maçtaki performansını (kronolojik sırayla) hesaplar.
 *
 * Tek bir toplu sorgu kullanır; her fikstür için ayrı ayrı sorgu
 * atmaz (N+1 önlenir).
 */
export async function buildTeamFormMap(
  seasonYear: number,
  before: Date = new Date(),
): Promise<Map<number, FormResult[]>> {
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
    orderBy: {
      kickoffAt: "asc",
    },
  });

  const formMap = new Map<number, FormResult[]>();

  const pushResult = (teamId: number, result: FormResult) => {
    const existing = formMap.get(teamId);
    if (existing) {
      existing.push(result);
    } else {
      formMap.set(teamId, [result]);
    }
  };

  for (const match of finishedMatches) {
    if (match.homeScore === null || match.awayScore === null) continue;

    if (match.homeScore > match.awayScore) {
      pushResult(match.homeTeamId, "W");
      pushResult(match.awayTeamId, "L");
    } else if (match.awayScore > match.homeScore) {
      pushResult(match.homeTeamId, "L");
      pushResult(match.awayTeamId, "W");
    } else {
      pushResult(match.homeTeamId, "D");
      pushResult(match.awayTeamId, "D");
    }
  }

  for (const [teamId, results] of formMap) {
    formMap.set(teamId, results.slice(-5));
  }

  return formMap;
}
