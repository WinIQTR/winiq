/**
 * Normalize all MEMBER users + prices to the single membership plan.
 * Usage: npx tsx scripts/normalize-single-membership.ts
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { SINGLE_MEMBERSHIP_PLAN } from "@/lib/membership-access";
import { SINGLE_MEMBERSHIP_PRICE } from "@/lib/membership-commerce";

async function main() {
  const users = await prisma.appUser.updateMany({
    where: {
      role: "MEMBER",
      plan: { in: ["BASIC", "ANALYSIS"] },
    },
    data: { plan: SINGLE_MEMBERSHIP_PLAN },
  });

  await prisma.membershipPlanPrice.upsert({
    where: { plan: SINGLE_MEMBERSHIP_PLAN },
    create: {
      plan: SINGLE_MEMBERSHIP_PLAN,
      priceTryCents: SINGLE_MEMBERSHIP_PRICE.priceTryCents,
      priceEurCents: SINGLE_MEMBERSHIP_PRICE.priceEurCents,
      isActive: true,
    },
    update: {
      priceTryCents: SINGLE_MEMBERSHIP_PRICE.priceTryCents,
      priceEurCents: SINGLE_MEMBERSHIP_PRICE.priceEurCents,
      isActive: true,
    },
  });

  await prisma.membershipPlanPrice.updateMany({
    where: { plan: { in: ["BASIC", "ANALYSIS"] } },
    data: { isActive: false },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        membersNormalized: users.count,
        listPriceTry: SINGLE_MEMBERSHIP_PRICE.priceTryCents / 100,
        listPriceEur: SINGLE_MEMBERSHIP_PRICE.priceEurCents / 100,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
