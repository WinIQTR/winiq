import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-session";
import {
  extendMembershipEndsAt,
  parseDurationFromNote,
  type MembershipDuration,
} from "@/lib/membership-commerce";
import { SINGLE_MEMBERSHIP_PLAN } from "@/lib/membership-access";
import { prisma } from "@/lib/prisma";

const DURATIONS = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Yetkisiz erişim." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const requestId = text(body?.requestId);
  const action = text(body?.action).toUpperCase();
  const adminNote = text(body?.adminNote).slice(0, 500) || null;
  const upgrade = await prisma.membershipUpgradeRequest.findUnique({ where: { id: requestId } });

  if (!upgrade || !["PENDING", "CONTACTED"].includes(upgrade.status)) {
    return NextResponse.json({ success: false, message: "Aktif yükseltme talebi bulunamadı." }, { status: 404 });
  }

  if (action === "CONTACTED") {
    await prisma.membershipUpgradeRequest.update({ where: { id: requestId }, data: { status: "CONTACTED", adminNote } });
    return NextResponse.json({ success: true, message: "Talep iletişime geçildi olarak işaretlendi." });
  }

  if (action === "REJECT") {
    await prisma.membershipUpgradeRequest.update({ where: { id: requestId }, data: { status: "REJECTED", adminNote, resolvedAt: new Date() } });
    return NextResponse.json({ success: true, message: "Talep reddedildi." });
  }

  if (action === "APPROVE") {
    const member = await prisma.appUser.findUnique({
      where: { id: upgrade.userId },
      select: { membershipEndsAt: true },
    });
    if (!member) {
      return NextResponse.json({ success: false, message: "Üye bulunamadı." }, { status: 404 });
    }

    const durationFromBody = DURATIONS.find(
      (item) => item === text(body?.duration).toUpperCase(),
    ) as MembershipDuration | undefined;
    const duration =
      durationFromBody ?? parseDurationFromNote(upgrade.memberNote) ?? undefined;

    const endsAtText = text(body?.membershipEndsAt);
    let membershipEndsAt: Date;
    if (endsAtText) {
      membershipEndsAt = new Date(endsAtText);
      if (Number.isNaN(membershipEndsAt.getTime()) || membershipEndsAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { success: false, message: "Gelecekte bir üyelik bitiş tarihi seçin." },
          { status: 400 },
        );
      }
    } else if (duration) {
      membershipEndsAt = extendMembershipEndsAt(member.membershipEndsAt, duration);
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Bitiş tarihi veya süre (MONTHLY / QUARTERLY / YEARLY) gerekli.",
        },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.appUser.update({
        where: { id: upgrade.userId },
        data: {
          plan: SINGLE_MEMBERSHIP_PLAN,
          status: "ACTIVE",
          membershipEndsAt,
        },
      }),
      prisma.membershipUpgradeRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", adminNote, resolvedAt: new Date() },
      }),
      prisma.userSession.deleteMany({ where: { userId: upgrade.userId } }),
    ]);
    return NextResponse.json({
      success: true,
      message: duration
        ? `Ödeme onaylandı · ${duration} uzatıldı · oturumlar kapatıldı.`
        : "Ödeme onaylandı; güvenlik için üyenin oturumları kapatıldı.",
      membershipEndsAt: membershipEndsAt.toISOString(),
    });
  }

  return NextResponse.json({ success: false, message: "Geçersiz işlem." }, { status: 400 });
}
