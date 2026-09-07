import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { calculateTeamForm } from "../src/modules/statistics-engine/calculate-team-form";

async function main(): Promise<void> {
  const team = await prisma.team.findFirst({
    where: {
      name: "Arsenal",
    },
  });

  if (!team) {
    throw new Error("Arsenal takım kaydı bulunamadı.");
  }

  const lastMatch = await prisma.match.findFirst({
    where: {
      OR: [
        { homeTeamId: team.id },
        { awayTeamId: team.id },
      ],
    },
    orderBy: {
      kickoffAt: "desc",
    },
  });

  if (!lastMatch) {
    throw new Error("Arsenal maç kaydı bulunamadı.");
  }

  const allForm = await calculateTeamForm({
    teamId: team.id,
    beforeDate: lastMatch.kickoffAt,
    matchLimit: 5,
    venue: "ALL",
  });

  const homeForm = await calculateTeamForm({
    teamId: team.id,
    beforeDate: lastMatch.kickoffAt,
    matchLimit: 5,
    venue: "HOME",
  });

  console.log("\nARSENAL FORM TESTİ\n");

  console.log({
    testMatchDate: lastMatch.kickoffAt,
    allForm,
    homeForm,
  });
}

main()
  .catch((error: unknown) => {
    console.error("Takım form testi başarısız:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });