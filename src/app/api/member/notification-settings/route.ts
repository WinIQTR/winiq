import { NextResponse } from "next/server";

import { requireMember } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireMember();
  const row = await prisma.appUser.findUnique({
    where: { id: user.id },
    select: {
      notifyEmailEnabled: true,
      notifyTelegramEnabled: true,
      telegramHandle: true,
      email: true,
    },
  });
  return NextResponse.json({
    success: true,
    settings: {
      notifyEmailEnabled: row?.notifyEmailEnabled ?? false,
      notifyTelegramEnabled: row?.notifyTelegramEnabled ?? false,
      telegramHandle: row?.telegramHandle ?? "",
      email: row?.email ?? user.email,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await requireMember();
  const body = (await request.json()) as {
    notifyEmailEnabled?: boolean;
    notifyTelegramEnabled?: boolean;
    telegramHandle?: string | null;
  };

  const telegramHandle =
    typeof body.telegramHandle === "string"
      ? body.telegramHandle.trim().replace(/^@/, "").slice(0, 64) || null
      : undefined;

  try {
    const updated = await prisma.appUser.update({
      where: { id: user.id },
      data: {
        ...(typeof body.notifyEmailEnabled === "boolean"
          ? { notifyEmailEnabled: body.notifyEmailEnabled }
          : {}),
        ...(typeof body.notifyTelegramEnabled === "boolean"
          ? { notifyTelegramEnabled: body.notifyTelegramEnabled }
          : {}),
        ...(telegramHandle !== undefined ? { telegramHandle } : {}),
      },
      select: {
        notifyEmailEnabled: true,
        notifyTelegramEnabled: true,
        telegramHandle: true,
      },
    });
    return NextResponse.json({
      success: true,
      message: "Bildirim tercihleri kaydedildi.",
      settings: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kayıt başarısız";
    return NextResponse.json(
      {
        success: false,
        message:
          message.includes("Unknown argument") || message.includes("column")
            ? "Veritabanı sütunları henüz yok. prisma migrate uygulayın (member_notification_prefs)."
            : message,
      },
      { status: 500 },
    );
  }
}
