import { PageShell } from "@/components/page-shell";
import {
  SpecialListView,
  buildSpecialListLabels,
} from "@/components/special-list-view";
import { translateUiText } from "@/i18n/dictionaries";
import { requireAdmin } from "@/lib/auth-session";
import { buildMatchFormTip } from "@/lib/member-match-insight";
import {
  buildSpecialCandidates,
  buildSpecialMarketMap,
  filterSpecialMatches,
  loadSpecialListPredictions,
  sortSpecialCandidates,
} from "@/lib/special-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SpecialPage({
  searchParams,
}: {
  searchParams?: Promise<{
    range?: string;
    market?: string;
    sortDate?: string;
    sortProb?: string;
    sortOdds?: string;
    minProb?: string;
    maxProb?: string;
  }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const range = q?.range === "week" ? "week" : "day";
  const market = q?.market || "ALL";
  const sortDate = q?.sortDate === "1";
  const sortProb = q?.sortProb === "1";
  const sortOdds = q?.sortOdds === "1";
  const minProb = q?.minProb ? Number(q.minProb) : null;
  const maxProb = q?.maxProb ? Number(q.maxProb) : null;

  const { predictions, source } = await loadSpecialListPredictions();
  const matches = filterSpecialMatches(predictions, range);
  const marketMap = buildSpecialMarketMap(matches);

  const rows = sortSpecialCandidates(
    buildSpecialCandidates(matches, market, { minProb, maxProb }),
    { sortDate, sortProb, sortOdds },
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
    <PageShell>
      <SpecialListView
        surface="admin"
        action="/special"
        range={range}
        market={market}
        marketOptions={marketOptions}
        rows={rows}
        tipsByKey={tipsByKey}
        source={source}
        matchHref={(matchId) => `/predictions?match=${matchId}`}
        labels={labels}
        locale="en"
        adminExtras={{
          sortDate,
          sortProb,
          sortOdds,
          minProb,
          maxProb,
        }}
      />
    </PageShell>
  );
}
