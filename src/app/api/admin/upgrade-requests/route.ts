import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

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
    const endsAtText = text(body?.membershipEndsAt);
    const membershipEndsAt = new Date(endsAtText);
    if (!endsAtText || Number.isNaN(membershipEndsAt.getTime()) || membershipEndsAt.getTime() <= Date.now()) {
      return NextResponse.json({ success: false, message: "Gelecekte bir üyelik bitiş tarihi seçin." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.appUser.update({
        where: { id: upgrade.userId },
        data: { plan: upgrade.requestedPlan, status: "ACTIVE", membershipEndsAt },
      }),
      prisma.membershipUpgradeRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", adminNote, resolvedAt: new Date() },
      }),
      prisma.userSession.deleteMany({ where: { userId: upgrade.userId } }),
    ]);
    return NextResponse.json({ success: true, message: "Paket yükseltildi; güvenlik için üyenin oturumları kapatıldı." });
  }

  return NextResponse.json({ success: false, message: "Geçersiz işlem." }, { status: 400 });
}
