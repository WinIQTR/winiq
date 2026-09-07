import "dotenv/config";

import { hashPassword } from "@/lib/auth-password";
import { prisma } from "@/lib/prisma";

const VALID_PLANS = ["BASIC", "ANALYSIS", "PROFESSIONAL"] as const;

async function main() {
  const email = process.env.MEMBER_EMAIL?.trim().toLowerCase();
  const password = process.env.MEMBER_PASSWORD ?? "";
  const name = process.env.MEMBER_NAME?.trim() || "Üye";
  const requestedPlan = process.env.MEMBER_PLAN?.trim().toUpperCase() || "BASIC";
  const plan = VALID_PLANS.find((item) => item === requestedPlan);
  const endsAtValue = process.env.MEMBER_ENDS_AT?.trim();
  const membershipEndsAt = endsAtValue ? new Date(endsAtValue) : null;

  if (!email || !email.includes("@")) throw new Error("MEMBER_EMAIL geçerli olmalıdır.");
  if (!plan) throw new Error("MEMBER_PLAN BASIC, ANALYSIS veya PROFESSIONAL olmalıdır.");
  if (membershipEndsAt && Number.isNaN(membershipEndsAt.getTime())) {
    throw new Error("MEMBER_ENDS_AT geçerli bir ISO tarih olmalıdır.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.appUser.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: "MEMBER",
      plan,
      status: "ACTIVE",
      membershipEndsAt,
    },
    update: {
      name,
      passwordHash,
      role: "MEMBER",
      plan,
      status: "ACTIVE",
      membershipEndsAt,
    },
  });

  await prisma.userSession.deleteMany({ where: { userId: user.id } });
  console.log(`Üye hesabı hazır: ${user.email} • ${user.plan}`);
  console.log("Mevcut oturumlar güvenlik amacıyla kapatıldı. Şifre ekrana yazdırılmadı.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
