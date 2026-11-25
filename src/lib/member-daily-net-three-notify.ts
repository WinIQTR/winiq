import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { notifyMemberChannels } from "@/lib/member-channel-notify";
import { buildMemberV2Desk } from "@/lib/member-v2-desk";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { prisma } from "@/lib/prisma";

const TZ = "Europe/Istanbul";

export type DailyNetThreeOptions = {
  now?: Date;
  dryRun?: boolean;
  siteOrigin?: string;
  stateDirectory?: string;
};

export type DailyNetThreeResult = {
  dayKey: string;
  pickCount: number;
  recipients: number;
  notified: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  picks: Array<{
    homeTeam: string;
    awayTeam: string;
    selection: string;
    confidence: number;
  }>;
};

function istanbulDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function statePath(dayKey: string, directory?: string): string {
  const root = directory ?? join(process.cwd(), "data", "operations");
  return join(root, `net3-notify-${dayKey}.json`);
}

async function loadSentIds(path: string): Promise<Set<string>> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as { userIds?: string[] };
    return new Set(Array.isArray(raw.userIds) ? raw.userIds : []);
  } catch {
    return new Set();
  }
}

async function saveSentIds(path: string, userIds: Set<string>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify(
      {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        userIds: [...userIds].sort(),
      },
      null,
      2,
    ),
    "utf8",
  );
}

function formatPickLine(
  pick: {
    homeTeam: string;
    awayTeam: string;
    selection: string;
    confidence: number;
    leagueName: string;
    kickoffIso: string;
  },
  index: number,
): string {
  const kick = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(pick.kickoffIso));
  return `${index + 1}) ${pick.homeTeam}–${pick.awayTeam} · ${pick.selection} · %${Math.round(pick.confidence)} · ${pick.leagueName} · ${kick}`;
}

/**
 * Broadcast today's desk top-3 (Günün net üçü) to members with notify prefs on.
 * Idempotent per Istanbul calendar day via operations state file.
 */
export async function deliverDailyNetThree(
  options: DailyNetThreeOptions = {},
): Promise<DailyNetThreeResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const dayKey = istanbulDayKey(now);
  const origin = (options.siteOrigin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://winiq.com").replace(
    /\/$/,
    "",
  );

  const predictions = await loadDashboardPredictionSnapshot(5_000);
  const desk = buildMemberV2Desk({ predictions, now });
  const picks = desk.topPicks.slice(0, 3);

  const result: DailyNetThreeResult = {
    dayKey,
    pickCount: picks.length,
    recipients: 0,
    notified: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    picks: picks.map((pick) => ({
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      selection: pick.selection,
      confidence: pick.confidence,
    })),
  };

  if (picks.length === 0) {
    return result;
  }

  const members = await prisma.appUser.findMany({
    where: {
      role: "MEMBER",
      status: "ACTIVE",
      OR: [{ notifyEmailEnabled: true }, { notifyTelegramEnabled: true }],
    },
    select: {
      id: true,
      email: true,
      name: true,
      notifyEmailEnabled: true,
      notifyTelegramEnabled: true,
      telegramHandle: true,
    },
  });

  result.recipients = members.length;
  const path = statePath(dayKey, options.stateDirectory);
  const already = await loadSentIds(path);

  const subject = `WINIQ · Günün net 3’ü · ${dayKey}`;
  const bodyLines = [
    `Günün net üçü (${dayKey}, Europe/Istanbul):`,
    "",
    ...picks.map((pick, index) => formatPickLine(pick, index)),
    "",
    `Masa: ${origin}/member`,
    "Bilgi amaçlıdır; kazanç garantisi yoktur.",
  ];

  for (const member of members) {
    if (already.has(member.id)) {
      result.skipped += 1;
      continue;
    }

    if (dryRun) {
      result.skipped += 1;
      continue;
    }

    try {
      const channels = await notifyMemberChannels(
        {
          userId: member.id,
          email: member.email,
          name: member.name,
          telegramHandle: member.telegramHandle,
          notifyEmailEnabled: member.notifyEmailEnabled,
          notifyTelegramEnabled: member.notifyTelegramEnabled,
          subject,
          text: [`Merhaba ${member.name},`, "", ...bodyLines].join("\n"),
          writeInbox: false,
        },
        async () => {
          /* digest is channel-only; avoid flooding support inbox daily */
        },
      );

      const sent = channels.some((row) => row.status === "SENT");
      if (sent) {
        already.add(member.id);
        result.notified += 1;
      } else {
        result.failed += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  if (!dryRun) {
    await saveSentIds(path, already);
  }

  return result;
}
