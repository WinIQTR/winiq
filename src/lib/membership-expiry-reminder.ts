import { notifyMemberChannels } from "@/lib/member-channel-notify";
import { prisma } from "@/lib/prisma";

const TZ = "Europe/Istanbul";
const REMINDER_MARKER = "[EXPIRY_REMINDER:";

export type MembershipExpiryReminderOptions = {
  now?: Date;
  /** Days before end to remind (default 7). */
  daysBefore?: number;
  /** Inclusive window around target day to tolerate cron jitter (default 0 = exact calendar day). */
  daySlack?: number;
  dryRun?: boolean;
};

export type MembershipExpiryReminderResult = {
  nowIso: string;
  targetDate: string;
  candidates: number;
  alreadySent: number;
  notified: number;
  failed: number;
  dryRun: boolean;
  details: Array<{
    userId: string;
    email: string;
    endsAt: string;
    status: "SENT" | "SKIPPED" | "FAILED" | "DRY_RUN";
    channels?: string;
  }>;
};

function istanbulDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function markerForEndsAt(endsAt: Date): string {
  return `${REMINDER_MARKER}${istanbulDateKey(endsAt)}]`;
}

/**
 * Members whose membershipEndsAt calendar day (Europe/Istanbul)
 * is ~daysBefore from today — e-posta / Telegram / inbox.
 */
export async function deliverMembershipExpiryReminders(
  options: MembershipExpiryReminderOptions = {},
): Promise<MembershipExpiryReminderResult> {
  const now = options.now ?? new Date();
  const daysBefore = options.daysBefore ?? 7;
  const daySlack = options.daySlack ?? 0;
  const dryRun = options.dryRun === true;

  const target = addCalendarDays(now, daysBefore);
  const targetKey = istanbulDateKey(target);
  const windowKeys = new Set<string>();
  for (let offset = -daySlack; offset <= daySlack; offset += 1) {
    windowKeys.add(istanbulDateKey(addCalendarDays(now, daysBefore + offset)));
  }

  const windowStart = addCalendarDays(now, daysBefore - daySlack - 1);
  const windowEnd = addCalendarDays(now, daysBefore + daySlack + 2);

  const members = await prisma.appUser.findMany({
    where: {
      role: "MEMBER",
      status: "ACTIVE",
      membershipEndsAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      membershipEndsAt: true,
      notifyEmailEnabled: true,
      notifyTelegramEnabled: true,
      telegramHandle: true,
    },
  });

  const candidates = members.filter((member) => {
    if (!member.membershipEndsAt) return false;
    return windowKeys.has(istanbulDateKey(member.membershipEndsAt));
  });

  const result: MembershipExpiryReminderResult = {
    nowIso: now.toISOString(),
    targetDate: targetKey,
    candidates: candidates.length,
    alreadySent: 0,
    notified: 0,
    failed: 0,
    dryRun,
    details: [],
  };

  for (const member of candidates) {
    const endsAt = member.membershipEndsAt!;
    const marker = markerForEndsAt(endsAt);
    const prior = await prisma.supportMessage.findFirst({
      where: {
        userId: member.id,
        sender: "ADMIN",
        body: { startsWith: marker },
      },
      select: { id: true },
    });

    if (prior) {
      result.alreadySent += 1;
      result.details.push({
        userId: member.id,
        email: member.email,
        endsAt: endsAt.toISOString(),
        status: "SKIPPED",
        channels: "already-sent",
      });
      continue;
    }

    const endsLabel = new Intl.DateTimeFormat("tr-TR", {
      timeZone: TZ,
      dateStyle: "long",
    }).format(endsAt);

    const subject = "WINIQ üyelik yenileme hatırlatması";
    const text = [
      marker,
      `Merhaba ${member.name},`,
      "",
      `WINIQ üyeliğiniz ${endsLabel} tarihinde sona eriyor (yaklaşık ${daysBefore} gün).`,
      "Kesintisiz devam için üye panelinden yenileme talebi oluşturabilir veya yöneticinize yazabilirsiniz.",
      "",
      "Bu bir hatırlatmadır; otomatik tahsilat yoktur.",
      "— WINIQ",
    ].join("\n");

    if (dryRun) {
      result.details.push({
        userId: member.id,
        email: member.email,
        endsAt: endsAt.toISOString(),
        status: "DRY_RUN",
      });
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
          text,
          writeInbox: true,
        },
        async (userId, body) => {
          await prisma.supportMessage.create({
            data: {
              userId,
              sender: "ADMIN",
              body: body.slice(0, 2000),
              readByAdmin: true,
              readByMember: false,
            },
          });
        },
      );

      const sentAny = channels.some((row) => row.status === "SENT");
      if (sentAny) result.notified += 1;
      else result.failed += 1;

      result.details.push({
        userId: member.id,
        email: member.email,
        endsAt: endsAt.toISOString(),
        status: sentAny ? "SENT" : "FAILED",
        channels: channels.map((row) => `${row.channel}:${row.status}`).join(","),
      });
    } catch (error: unknown) {
      result.failed += 1;
      result.details.push({
        userId: member.id,
        email: member.email,
        endsAt: endsAt.toISOString(),
        status: "FAILED",
        channels: error instanceof Error ? error.message : "error",
      });
    }
  }

  return result;
}
