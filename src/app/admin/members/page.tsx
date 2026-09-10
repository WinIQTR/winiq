import { AdminMembersManager } from "@/components/admin-members-manager";
import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getMembershipPaymentSettings } from "@/lib/membership-payment-settings";

export default async function AdminMembersPage() {
  await requireAdmin();
  const paymentSettings = getMembershipPaymentSettings();
  const [members, upgradeRequests, prices] = await Promise.all([prisma.appUser.findMany({
    where: { role: "MEMBER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      status: true,
      membershipEndsAt: true,
      createdAt: true,
      _count: { select: { sessions: true } },
    },
  }), prisma.membershipUpgradeRequest.findMany({
    where: { status: { in: ["PENDING", "CONTACTED"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      currentPlan: true,
      requestedPlan: true,
      status: true,
      memberNote: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  }), prisma.membershipPlanPrice.findMany({ orderBy: { plan: "asc" } })]);

  return (
    <PageShell>
      <header className="topbar dashboard-topbar">
        <div><p className="eyebrow">MEMBERSHIP CONTROL</p><h1>Üye yönetimi</h1><p className="subtitle">Kullanıcı erişimleri, paketler ve oturumlar tek merkezden yönetilir.</p></div>
        <div className="member-actions"><a className="member-plan-link" href="/admin/members/preview?plan=BASIC">Üye arayüzlerini kontrol et</a><span className="mode-badge">ADMIN ONLY</span></div>
      </header>
      <AdminMembersManager members={members.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        plan: member.plan,
        status: member.status,
        membershipEndsAt: member.membershipEndsAt?.toISOString() ?? null,
        createdAt: member.createdAt.toISOString(),
        sessionCount: member._count.sessions,
      }))} upgradeRequests={upgradeRequests.map((request) => ({
        id: request.id,
        userName: request.user.name,
        userEmail: request.user.email,
        currentPlan: request.currentPlan,
        requestedPlan: request.requestedPlan,
        status: request.status,
        memberNote: request.memberNote,
        createdAt: request.createdAt.toISOString(),
      }))} prices={prices.map((price) => ({
        plan: price.plan,
        priceTry: price.priceTryCents / 100,
        priceEur: price.priceEurCents / 100,
      }))} paymentSettings={paymentSettings} />
    </PageShell>
  );
}
