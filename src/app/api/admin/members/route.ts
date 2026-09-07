import { NextRequest, NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth-password";
import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { MEMBERSHIP_PLAN_LABELS } from "@/lib/membership-access";

const PLANS = ["BASIC", "ANALYSIS", "PROFESSIONAL"] as const;
const STATUSES = ["ACTIVE", "SUSPENDED"] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function requireApiAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}

export async function POST(request: NextRequest) {
  if (!(await requireApiAdmin())) {
    return NextResponse.json({ success: false, message: "Yetkisiz erişim." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = text(body?.email).toLowerCase();
  const name = text(body?.name);
  const password = text(body?.password);
  const plan = PLANS.find((item) => item === text(body?.plan).toUpperCase());
  const endsAtText = text(body?.membershipEndsAt);
  const membershipEndsAt = endsAtText ? new Date(endsAtText) : null;

  if (!email.includes("@") || !name || !plan) {
    return NextResponse.json({ success: false, message: "Ad, e-posta ve paket zorunludur." }, { status: 400 });
  }
  if (membershipEndsAt && Number.isNaN(membershipEndsAt.getTime())) {
    return NextResponse.json({ success: false, message: "Üyelik bitiş tarihi geçersiz." }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(password);
    await prisma.appUser.create({
      data: {
        email,
        name,
        passwordHash,
        role: "MEMBER",
        plan,
        status: "ACTIVE",
        membershipEndsAt,
      },
    });

    return NextResponse.json({ success: true, message: "Üye oluşturuldu." });
  } catch (error: unknown) {
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "Bu e-posta zaten kayıtlı."
      : error instanceof Error ? error.message : "Üye oluşturulamadı.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireApiAdmin())) {
    return NextResponse.json({ success: false, message: "Yetkisiz erişim." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = text(body?.userId);
  const action = text(body?.action);
  const member = await prisma.appUser.findFirst({ where: { id: userId, role: "MEMBER" } });

  if (!member) {
    return NextResponse.json({ success: false, message: "Üye bulunamadı." }, { status: 404 });
  }

  if (action === "REVOKE_SESSIONS") {
    await prisma.userSession.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true, message: "Üyenin oturumları kapatıldı." });
  }

  if (action === "RESET_PASSWORD") {
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(text(body?.password));
    } catch (error: unknown) {
      return NextResponse.json(
        { success: false, message: error instanceof Error ? error.message : "Şifre geçersiz." },
        { status: 400 },
      );
    }
    await prisma.$transaction([
      prisma.appUser.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.userSession.deleteMany({ where: { userId } }),
    ]);
    return NextResponse.json({ success: true, message: "Şifre yenilendi ve oturumlar kapatıldı." });
  }

  if (action === "UPDATE_ACCESS") {
    const plan = PLANS.find((item) => item === text(body?.plan).toUpperCase());
    const status = STATUSES.find((item) => item === text(body?.status).toUpperCase());
    const endsAtText = text(body?.membershipEndsAt);
    const membershipEndsAt = endsAtText ? new Date(endsAtText) : null;

    if (!plan || !status || (membershipEndsAt && Number.isNaN(membershipEndsAt.getTime()))) {
      return NextResponse.json({ success: false, message: "Paket, durum veya tarih geçersiz." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.appUser.update({
        where: { id: userId },
        data: { plan, status, membershipEndsAt },
      }),
      prisma.userSession.deleteMany({ where: { userId } }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Üyelik ${MEMBERSHIP_PLAN_LABELS[plan]} olarak kaydedildi. Doğru paketin kesin uygulanması için üyenin açık oturumları kapatıldı.`,
    });
  }

  return NextResponse.json({ success: false, message: "Geçersiz işlem." }, { status: 400 });
}
