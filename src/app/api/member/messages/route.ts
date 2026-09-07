import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

function messageBody(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 2_000) : "";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "MEMBER") {
    return NextResponse.json({ success: false, message: "Üye oturumu gerekli." }, { status: 403 });
  }
  const body = messageBody(((await request.json().catch(() => null)) as { body?: unknown } | null)?.body);
  if (body.length < 3) {
    return NextResponse.json({ success: false, message: "Mesaj en az 3 karakter olmalıdır." }, { status: 400 });
  }
  const recentCount = await prisma.supportMessage.count({
    where: { userId: user.id, sender: "MEMBER", createdAt: { gte: new Date(Date.now() - 10 * 60 * 1_000) } },
  });
  if (recentCount >= 5) {
    return NextResponse.json({ success: false, message: "Kısa sürede çok fazla mesaj gönderdiniz. Lütfen daha sonra tekrar deneyin." }, { status: 429 });
  }
  await prisma.supportMessage.create({ data: { userId: user.id, sender: "MEMBER", body, readByMember: true } });
  return NextResponse.json({ success: true, message: "Mesajınız yöneticiye gönderildi." });
}

export async function PATCH() {
  const user = await getCurrentUser();
  if (!user || user.role !== "MEMBER") {
    return NextResponse.json({ success: false }, { status: 403 });
  }
  await prisma.supportMessage.updateMany({ where: { userId: user.id, sender: "ADMIN", readByMember: false }, data: { readByMember: true } });
  return NextResponse.json({ success: true });
}
