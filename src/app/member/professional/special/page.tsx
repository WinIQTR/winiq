import { redirect } from "next/navigation";

import {
  SpecialListView,
  buildSpecialListLabels,
} from "@/components/special-list-view";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { translateUiText } from "@/i18n/dictionaries";
import { requireMember } from "@/lib/auth-session";
import { buildMatchFormTip } from "@/lib/member-match-insight";
import {
  applySpecialChipFilters,
  buildSpecialCandidates,
  buildSpecialMarketMap,
  filterSpecialMatches,
  loadSpecialListPredictions,
  parseSpecialOddsBand,
  parseSpecialProbMin,
  sortSpecialCandidates,
} from "@/lib/special-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfessionalSpecialPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: string;
    market?: string;
    pMin?: string;
    odds?: string;
  }>;
}) {
  const user = await requireMember();
  const localReviewBypass = process.env.NODE_ENV !== "production";
  if (user.plan !== "PROFESSIONAL" && !localReviewBypass) redirect("/member/plans");

  const q = await searchParams;
  const range = q?.range === "week" ? "week" : "day";
  const market = q?.market ?? "ALL";
  const probMin = parseSpecialProbMin(q?.pMin);
  const oddsBand = parseSpecialOddsBand(q?.odds);

  const { predictions, source } = await loadSpecialListPredictions();
  const matches = filterSpecialMatches(predictions, range);
  const marketMap = buildSpecialMarketMap(matches);

  const rows = applySpecialChipFilters(
    sortSpecialCandidates(buildSpecialCandidates(matches, market), {
      sortProb: true,
    }),
    { probMin, oddsBand },
  );

  const tipTranslate = (sourceText: string) => translateUiText(sourceText, "tr");
  const tipsByKey: Record<string, string | null> = {};
  for (const item of rows) {
    const key = `${item.prediction.matchId}|${item.marketKey}|${item.selection}`;
    tipsByKey[key] = buildMatchFormTip(
      {
        homeTeam: item.prediction.homeTeam,
        awayTeam: item.prediction.awayTeam,
        homeRecentResults: item.prediction.homeRecentResults,
        awayRecentResults: item.prediction.awayRecentResults,
        homeVenueResults: item.prediction.homeVenueResults,
        awayVenueResults: item.prediction.awayVenueResults,
      },
      tipTranslate,
    );
  }

  const labels = buildSpecialListLabels("en");
  const marketOptions = [
    { value: "ALL", label: "All bets · highest probability" },
    ...[...marketMap]
      .filter(([value]) => value !== "ALL")
      .map(([value, label]) => ({ value, label })),
  ];

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="special" />
      <div className={member.page}>
        <SpecialListView
          surface="member"
          action="/member/professional/special"
          range={range}
          market={market}
          marketOptions={marketOptions}
          rows={rows}
          tipsByKey={tipsByKey}
          source={source}
          matchHref={(matchId) => `/member/matches/${matchId}`}
          labels={labels}
          locale="en"
          probMin={probMin}
          oddsBand={oddsBand}
        />
      </div>
    </main>
  );
}
