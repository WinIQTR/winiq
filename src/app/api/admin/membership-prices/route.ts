import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const PLANS = ["BASIC", "ANALYSIS", "PROFESSIONAL"] as const;

export async function PATCH(request: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Yetkisiz erişim." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const plan = PLANS.find((item) => item === String(body?.plan ?? "").toUpperCase());
  const priceTryCents = Math.round(Number(body?.priceTry ?? 0) * 100);
  const priceEurCents = Math.round(Number(body?.priceEur ?? 0) * 100);

  if (!plan || !Number.isSafeInteger(priceTryCents) || !Number.isSafeInteger(priceEurCents) || priceTryCents < 0 || priceEurCents < 0) {
    return NextResponse.json({ success: false, message: "Paket fiyatları geçersiz." }, { status: 400 });
  }

  await prisma.membershipPlanPrice.upsert({
    where: { plan },
    create: { plan, priceTryCents, priceEurCents },
    update: { priceTryCents, priceEurCents },
  });

  return NextResponse.json({ success: true, message: `${plan} fiyatları güncellendi.` });
}
