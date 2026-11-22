import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-session";
import { SINGLE_MEMBERSHIP_PLAN } from "@/lib/membership-access";
import { isRenewalRequestAllowed } from "@/lib/membership-commerce";
import { prisma } from "@/lib/prisma";

const DURATIONS = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "MEMBER") {
    return NextResponse.json(
      { success: false, message: "Üye oturumu gerekli." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const requestedPlan = SINGLE_MEMBERSHIP_PLAN;
  const duration = DURATIONS.find((item) => item === text(body?.duration).toUpperCase()) ?? "MONTHLY";
  const noteFromBody = text(body?.memberNote).slice(0, 500);
  const memberNote =
    noteFromBody || `RENEW ${duration} · single membership`;

  if (!isRenewalRequestAllowed(user.plan, requestedPlan)) {
    return NextResponse.json(
      { success: false, message: "Geçersiz üyelik talebi." },
      { status: 400 },
    );
  }

  const existing = await prisma.membershipUpgradeRequest.findFirst({
    where: { userId: user.id, status: { in: ["PENDING", "CONTACTED"] } },
  });
  if (existing) {
    return NextResponse.json(
      { success: false, message: "Zaten değerlendirilmekte olan bir talebiniz var." },
      { status: 409 },
    );
  }

  await prisma.membershipUpgradeRequest.create({
    data: {
      userId: user.id,
      currentPlan: user.plan,
      requestedPlan,
      memberNote,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Yenileme / uzatma talebiniz yöneticiye iletildi.",
  });
}
