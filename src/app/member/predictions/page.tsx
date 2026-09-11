import dashboard from "@/app/admin-dashboard/admin-dashboard.module.css";
import { MemberPortalHeader, MemberPredictionRow } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { requireMember } from "@/lib/auth-session";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";

export const dynamic="force-dynamic";
export const revalidate=0;

export default async function MemberPredictionsPage(){
  const user=await requireMember();
  const now=new Date();
  const predictions=(await loadDashboardPredictionSnapshot(5_000)).filter(item=>item.kickoffAt>=now&&(item.settlementStatus===undefined||item.settlementStatus==="PENDING")).sort((a,b)=>a.kickoffAt.getTime()-b.kickoffAt.getTime());
  return <main className={member.shell}><MemberPortalHeader plan={user.plan} active="predictions"/><div className={member.page}><section className={member.welcome}><div><p><i/> WINIQ · TÜM YAYIMLANMIŞ VERİLER</p><h1>Tüm Tahminler</h1><span>Yaklaşan {predictions.length} maç; tarih sırasına göre tek listede.</span></div></section><section className={dashboard.predictionPanel}><header><div><h2>YAKLAŞAN MAÇLAR</h2><p>Her karşılaşma yalnız bilgi ve model değerlendirmesi sunar.</p></div><span>{predictions.length} maç</span></header><div className={dashboard.matchList}>{predictions.length?predictions.map(item=><MemberPredictionRow prediction={item} plan={user.plan} href={`/member/matches/${item.matchId}`} key={item.matchId}/>):<div className={dashboard.empty}>Yaklaşan yayımlanmış tahmin bulunamadı.</div>}</div></section><footer className={dashboard.footer}><b>WINIQ</b><span>Kullanıcı kendi kararını verir.</span><small>Kupon veya kazanç garantisi sunulmaz.</small></footer></div></main>;
}
