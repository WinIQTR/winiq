import "dotenv/config";

import { prisma } from "@/lib/prisma";

const PLACEHOLDER_EMAIL = "kendi-epostaniz@adresiniz.com";

async function main() {
  const result = await prisma.appUser.deleteMany({
    where: { email: PLACEHOLDER_EMAIL },
  });

  console.log(
    result.count === 0
      ? "Örnek yönetici hesabı bulunmadı; değişiklik yapılmadı."
      : "Örnek yönetici hesabı ve oturumları silindi.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
