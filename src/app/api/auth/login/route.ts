import { NextRequest, NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth-password";
import { createUserSession } from "@/lib/auth-session";
import { isMembershipActive } from "@/lib/membership-access";
import { prisma } from "@/lib/prisma";

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAXIMUM_FAILED_ATTEMPTS = 5;
const DUMMY_PASSWORD_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password || password.length > 256) {
    return NextResponse.json(
      { success: false, message: "E-posta veya şifre hatalı." },
      { status: 400 },
    );
  }

  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  const failedAttempts = await prisma.loginAttempt.count({
    where: { email, success: false, createdAt: { gte: windowStart } },
  });

  if (failedAttempts >= MAXIMUM_FAILED_ATTEMPTS) {
    return NextResponse.json(
      { success: false, message: "Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin." },
      { status: 429 },
    );
  }

  const user = await prisma.appUser.findUnique({ where: { email } });
  const passwordMatches = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  const active = user
    ? isMembershipActive(user.status, user.membershipEndsAt)
    : false;
  const success = Boolean(user && passwordMatches && active);

  await prisma.loginAttempt.create({ data: { email, success } });

  if (!success || !user) {
    return NextResponse.json(
      { success: false, message: "E-posta veya şifre hatalı ya da üyelik aktif değil." },
      { status: 401 },
    );
  }

  await createUserSession(user.id);

  return NextResponse.json({
    success: true,
    destination: user.role === "ADMIN" ? "/admin-dashboard" : "/member",
  });
}
