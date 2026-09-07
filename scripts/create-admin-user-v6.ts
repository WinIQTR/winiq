import "dotenv/config";

import { hashPassword } from "@/lib/auth-password";
import { prisma } from "@/lib/prisma";

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Sistem Yöneticisi";

  if (!email || !email.includes("@")) throw new Error("BOOTSTRAP_ADMIN_EMAIL geçerli olmalıdır.");

  const passwordHash = await hashPassword(password);
  const user = await prisma.appUser.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
      plan: "PROFESSIONAL",
      status: "ACTIVE",
    },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      membershipEndsAt: null,
    },
  });

  await prisma.userSession.deleteMany({ where: { userId: user.id } });
  console.log(`Yönetici hesabı hazır: ${user.email}`);
  console.log("Mevcut oturumlar güvenlik amacıyla kapatıldı. Şifre ekrana yazdırılmadı.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
