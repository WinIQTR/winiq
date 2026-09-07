import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function adminUser() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}

export async function POST(request: NextRequest) {
  if (!(await adminUser())) return NextResponse.json({ success: false, message: "Yetkisiz erişim." }, { status: 403 });
  const payload = (await request.json().catch(() => null)) as { userId?: unknown; body?: unknown } | null;
  const userId = text(payload?.userId);
  const body = text(payload?.body).slice(0, 2_000);
  if (!userId || body.length < 2) return NextResponse.json({ success: false, message: "Geçerli bir üye ve mesaj gerekli." }, { status: 400 });
  const member = await prisma.appUser.findFirst({ where: { id: userId, role: "MEMBER" }, select: { id: true } });
  if (!member) return NextResponse.json({ success: false, message: "Üye bulunamadı." }, { status: 404 });
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { userId, sender: "ADMIN", body, readByAdmin: true } }),
    prisma.supportMessage.updateMany({ where: { userId, sender: "MEMBER", readByAdmin: false }, data: { readByAdmin: true } }),
  ]);
  return NextResponse.json({ success: true, message: "Yanıt üyeye gönderildi." });
}

export async function PATCH(request: NextRequest) {
  if (!(await adminUser())) return NextResponse.json({ success: false }, { status: 403 });
  const payload = (await request.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = text(payload?.userId);
  if (!userId) return NextResponse.json({ success: false }, { status: 400 });
  await prisma.supportMessage.updateMany({ where: { userId, sender: "MEMBER", readByAdmin: false }, data: { readByAdmin: true } });
  return NextResponse.json({ success: true });
}
