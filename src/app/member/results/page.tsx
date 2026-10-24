import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { MemberResultsBoard } from "@/components/member-results-board";
import { requireMember } from "@/lib/auth-session";
import { loadMemberPastPerformance } from "@/lib/member-past-performance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberResultsPage() {
  const user = await requireMember();
  const { performance, matches } = await loadMemberPastPerformance({
    matchLimit: 40,
  });

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="results" memberName={user.name} />
      <div className={member.page}>
        <MemberResultsBoard
          strong={{
            rate: performance.strong.rate,
            wins: performance.strong.wins,
            losses: performance.strong.losses,
            samples: performance.strong.samples,
          }}
          medium={{
            rate: performance.medium.rate,
            wins: performance.medium.wins,
            losses: performance.medium.losses,
            samples: performance.medium.samples,
          }}
          weak={{
            rate: performance.weak.rate,
            wins: performance.weak.wins,
            losses: performance.weak.losses,
            samples: performance.weak.samples,
          }}
          matches={matches}
          todayHref="/member"
        />
      </div>
    </main>
  );
}
