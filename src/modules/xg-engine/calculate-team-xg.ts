export type TeamXgStatistics = {
  teamId: number;
  matches: number;
  averageXg: number | null;
  averageXga: number | null;
  averageXgd: number | null;
  last5AverageXg: number | null;
  last5AverageXga: number | null;
  last5AverageXgd: number | null;
  dataQuality: number;
};

export type CalculateTeamXgOptions = {
  teamId: number;
  season: number;
  beforeDate: Date;
};

export async function calculateTeamXg(
  options: CalculateTeamXgOptions,
): Promise<TeamXgStatistics> {
  return {
    teamId: options.teamId,
    matches: 0,
    averageXg: null,
    averageXga: null,
    averageXgd: null,
    last5AverageXg: null,
    last5AverageXga: null,
    last5AverageXgd: null,
    dataQuality: 0,
  };
}