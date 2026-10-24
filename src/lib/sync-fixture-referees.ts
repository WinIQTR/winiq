import "dotenv/config";

import { apiFootballRequest } from "@/lib/api-football/client";
import { prisma } from "@/lib/prisma";

type FixtureRow = {
  fixture: {
    id: number;
    referee?: string | null;
    venue?: { name?: string | null; city?: string | null };
  };
};

const BATCH_SIZE = 20;

/**
 * Pulls referee (and venue when missing) from API-Football for matches
 * that still have an empty referee in DB. Batches by apiId (max 20).
 */
export async function syncMissingFixtureReferees(
  matches: Array<{
    id: number;
    apiId: number;
    referee: string | null;
    venueName: string | null;
    venueCity?: string | null;
  }>,
  options?: { maxBatches?: number },
): Promise<{ updated: number; checked: number }> {
  const missing = matches.filter(
    (match) => !match.referee?.trim() || !match.venueCity?.trim(),
  );
  if (!missing.length) return { updated: 0, checked: 0 };

  const maxBatches = Math.max(1, options?.maxBatches ?? 3);
  let updated = 0;
  let checked = 0;

  for (let offset = 0; offset < missing.length && offset / BATCH_SIZE < maxBatches; offset += BATCH_SIZE) {
    const batch = missing.slice(offset, offset + BATCH_SIZE);
    const ids = batch.map((match) => match.apiId).join("-");
    const byApiId = new Map(batch.map((match) => [match.apiId, match]));

    try {
      const response = await apiFootballRequest<FixtureRow[]>(
        "fixtures",
        { ids },
        { bypassRateLimit: true },
      );
      checked += batch.length;

      for (const row of response.response ?? []) {
        const local = byApiId.get(row.fixture.id);
        if (!local) continue;

        const referee = row.fixture.referee?.trim() || null;
        const venueName = row.fixture.venue?.name?.trim() || null;
        const venueCity = row.fixture.venue?.city?.trim() || null;
        if (!referee && !venueCity && !venueName) continue;

        await prisma.match.update({
          where: { id: local.id },
          data: {
            ...(referee ? { referee } : {}),
            ...(!local.venueName && venueName ? { venueName } : {}),
            ...(!local.venueCity && venueCity ? { venueCity } : {}),
          },
        });

        if (referee || venueCity) {
          if (referee) local.referee = referee;
          if (venueCity) local.venueCity = venueCity;
          updated += 1;
        }
      }
    } catch (error) {
      console.error("[syncMissingFixtureReferees]", error);
      break;
    }
  }

  return { updated, checked };
}
