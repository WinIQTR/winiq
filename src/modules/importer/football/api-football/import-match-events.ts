import { apiFootballRequest } from "@/lib/api-football/client";
import { prisma } from "@/lib/prisma";

type EventRow = {
  time: { elapsed: number | null; extra?: number | null };
  team?: { id: number } | null;
  player?: { name?: string | null } | null;
  assist?: { name?: string | null } | null;
  type: string;
  detail?: string | null;
};

/**
 * Pull fixtures/events for finished matches missing event rows.
 * Caps API spend via maximumMatches.
 */
export async function importMatchEventsFromApiFootball(options: {
  seasonYear: number;
  maximumMatches?: number;
}): Promise<{ matches: number; events: number }> {
  const max = Math.max(1, options.maximumMatches ?? 15);

  const candidates = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      season: { year: options.seasonYear },
      matchEvents: { none: {} },
    },
    orderBy: { kickoffAt: "desc" },
    take: max,
    select: { id: true, apiId: true },
  });

  let events = 0;
  let matches = 0;

  for (const match of candidates) {
    try {
      const data = await apiFootballRequest<EventRow[]>("fixtures/events", {
        fixture: match.apiId,
      });
      const rows = data.response ?? [];
      if (!rows.length) {
        matches += 1;
        continue;
      }

      for (const row of rows) {
        const elapsed = row.time?.elapsed;
        if (elapsed == null) continue;
        let teamId: number | null = null;
        if (row.team?.id) {
          const team = await prisma.team.findUnique({
            where: { apiId: row.team.id },
            select: { id: true },
          });
          teamId = team?.id ?? null;
        }
        await prisma.matchEvent.create({
          data: {
            matchId: match.id,
            teamId,
            elapsed,
            extra: row.time.extra ?? null,
            type: row.type,
            detail: row.detail ?? null,
            playerName: row.player?.name ?? null,
            assistName: row.assist?.name ?? null,
          },
        });
        events += 1;
      }
      matches += 1;
    } catch (error) {
      console.error("[importMatchEvents]", match.apiId, error);
      break;
    }
  }

  return { matches, events };
}
