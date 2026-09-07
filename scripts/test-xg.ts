import { calculateTeamXg } from "../src/modules/xg-engine/calculate-team-xg";

async function main() {
  const result = await calculateTeamXg({
    teamId: 1,
    season: 2024,
    beforeDate: new Date(),
  });

  console.log(result);
}

main();