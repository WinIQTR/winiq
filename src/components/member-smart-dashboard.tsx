import Image from "next/image";
import Link from "next/link";

import dashboard from "@/app/admin-dashboard/admin-dashboard.module.css";
import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MEMBERSHIP_PLAN_LABELS, MEMBERSHIP_PLAN_MARKET_LIMITS, type MembershipPlanName } from "@/lib/membership-access";
import { getPredictionLabel, type DashboardPrediction } from "@/lib/prediction-dashboard-shared";

import styles from "./member-smart-dashboard.module.css";

const TURKEY_TIME_ZONE = "Europe/Istanbul";
const formatTime = (date: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone:TURKEY_TIME_ZONE, day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }).format(date);
const fairOdds = (prediction: DashboardPrediction) => prediction.predictedProbability > 0 ? 100 / prediction.predictedProbability : 0;
const outcomeLabel = (prediction: DashboardPrediction) => prediction.predictedOutcome === "HOME" ? "1 (Ev sahibi)" : prediction.predictedOutcome === "AWAY" ? "2 (Deplasman)" : "X (Beraberlik)";
const translate = (value:string) => value.replace(/Home Team Goals/gi,"Ev sahibi takım golü").replace(/Away Team Goals/gi,"Deplasman takım golü").replace(/Total Goals/gi,"Toplam gol").replace(/Both Teams To Score/gi,"Karşılıklı gol").replace(/Under/gi,"Alt").replace(/Over/gi,"Üst").replace(/Home/gi,"Ev sahibi").replace(/Away/gi,"Deplasman").replace(/Draw/gi,"Beraberlik");

function TeamLogo({src,name}:{src:string|null;name:string}) {
  return src?<Image src={src} alt={`${name} logosu`} width={42} height={42}/>:<span className={dashboard.logoFallback}>{name.slice(0,2).toUpperCase()}</span>;
}

export type MemberPerformanceBand = { rate:number|null; samples:number; wins:number; losses:number; voids:number; unavailable:number; total:number };
export type MemberPerformance = { strong:MemberPerformanceBand; medium:MemberPerformanceBand; weak:MemberPerformanceBand };

export function MemberPortalHeader({plan,preview=false,active="home"}:{plan:MembershipPlanName;preview?:boolean;active?:"home"|"predictions"|"fixtures"|"players"|"scorers"|"standings"|"plans"}) {
  const home=preview?`/admin/members/preview?plan=${plan}`:"/member";
  const planLink=preview?`/admin/members/preview?plan=${plan}#paket`:"/member/plans";
  return <header className={styles.topbar}><Link href={home} className={styles.brand} aria-label="WINIQ" data-no-translate>WIN<span>IQ</span></Link><nav><Link data-active={active==="home"} href={home}>Ana Sayfa</Link><Link data-active={active==="predictions"} href="/member/predictions">Tahminler</Link>{plan==="PROFESSIONAL"?<><Link data-active={active==="fixtures"} href="/member/professional?view=fixtures">Fikstür</Link><Link data-active={active==="players"} href="/member/professional?view=players">Oyuncular</Link><Link data-active={active==="scorers"} href="/member/professional?view=scorers">Gol Krallığı</Link><Link data-active={active==="standings"} href="/member/professional?view=standings">Puan Durumu</Link></>:null}<Link data-active={active==="plans"} href={planLink}>Paketler</Link></nav><div className={styles.actions}><LanguageSwitcher/><span className={styles.plan}>♛ {MEMBERSHIP_PLAN_LABELS[plan]}</span>{!preview?<LogoutButton/>:null}</div></header>;
}

export function MemberPredictionRow({prediction,plan,href}:{prediction:DashboardPrediction;plan:MembershipPlanName;href:string}) {
  const reasons=prediction.topPicks[0]?.reasons.slice(0,2)??[];
  return <article className={dashboard.matchCard}>
    <div className={dashboard.matchMain}>
      <div className={dashboard.matchMeta}><strong>{prediction.leagueName}</strong><span>{formatTime(prediction.kickoffAt)}</span></div>
      <div className={dashboard.teams}><div><TeamLogo src={prediction.homeTeamLogo} name={prediction.homeTeam}/><strong>{prediction.homeTeam}</strong></div><b>–</b><div><TeamLogo src={prediction.awayTeamLogo} name={prediction.awayTeam}/><strong>{prediction.awayTeam}</strong></div></div>
      {plan!=="BASIC"?<div className={dashboard.probabilities}><span>1 <b>%{prediction.homeProbability.toFixed(0)}</b><i style={{width:`${prediction.homeProbability}%`}}/></span><span>X <b>%{prediction.drawProbability.toFixed(0)}</b><i style={{width:`${prediction.drawProbability}%`}}/></span><span>2 <b>%{prediction.awayProbability.toFixed(0)}</b><i style={{width:`${prediction.awayProbability}%`}}/></span></div>:<div className={styles.locked}>◇ 1/X/2 Analiz paketinde</div>}
      {plan==="PROFESSIONAL"?<div className={dashboard.xg}><span>Beklenen gol</span><strong>{(prediction.expectedHomeGoals+prediction.expectedAwayGoals).toFixed(1)}</strong></div>:<div className={styles.locked}>◇ xG Profesyonel pakette</div>}
      <div className={dashboard.choice}><span className={dashboard.strongBadge}>GÜÇLÜ</span><small>En iyi seçim</small><strong>{translate(getPredictionLabel(prediction))}</strong></div>
      <div className={dashboard.confidence}><span>Güven</span><strong>%{prediction.confidenceScore.toFixed(0)}</strong></div>
      {plan!=="BASIC"?<div className={dashboard.odds}><span>Adil oran</span><strong>{fairOdds(prediction).toFixed(2)}</strong></div>:<div className={styles.locked}>◇ Oran kilitli</div>}
    </div>
    <div className={dashboard.reasonBar}><strong>⌄ &nbsp; Neden bu tahmin?</strong>{plan==="PROFESSIONAL"&&reasons.length?reasons.map(reason=><span key={reason}>◆ {reason}</span>):<span>◆ Ayrıntılı gerekçeler Profesyonel üyelikte gösterilir.</span>}<Link href={href}>Analizi gör →</Link></div>
  </article>;
}

function planMessage(plan:MembershipPlanName) {
  if(plan==="BASIC")return "6 temel pazarda sade ve anlaşılır tahminler.";
  if(plan==="ANALYSIS")return "19 pazar, ayrıntılı olasılıklar ve karşılaştırmalı analiz.";
  return "27 pazarın tamamı, profesyonel göstergeler ve gelişmiş karar araçları.";
}

export function MemberSmartDashboard({name,plan,predictions,preview=false,performance}:{name:string;plan:MembershipPlanName;predictions:DashboardPrediction[];preview?:boolean;performance?:MemberPerformance}) {
  const sorted=[...predictions].sort((a,b)=>b.confidenceScore-a.confidenceScore);
  const strongest=sorted[0];
  const featured=sorted.slice(0,3);
  const strong=predictions.filter(item=>item.confidenceScore>=70);
  const strong150=strong.filter(item=>fairOdds(item)>=1.5).sort((a,b)=>b.confidenceScore-a.confidenceScore).slice(0,5);
  const average=predictions.length?predictions.reduce((sum,item)=>sum+item.confidenceScore,0)/predictions.length:0;
  const averagePrediction=predictions.length?predictions.reduce((sum,item)=>sum+item.predictedProbability,0)/predictions.length:0;
  const matchHref=(id:number)=>preview?`/admin/members/preview/matches/${id}?plan=${plan}`:`/member/matches/${id}`;
  const plansHref=preview?`/admin/members/preview?plan=${plan}#paket`:"/member/plans";
  return <main className={`${styles.shell} member-plan-${plan.toLowerCase()}`}>
    {preview?<div className={styles.preview}><span>YÖNETİCİ ÖNİZLEMESİ</span><strong>{MEMBERSHIP_PLAN_LABELS[plan]} üye görünümü</strong><Link href="/admin/members">Önizlemeden çık</Link></div>:null}
    <MemberPortalHeader plan={plan} preview={preview}/>
    <div className={styles.page}>
      <section className={styles.welcome}><div><p><i/> AI FUTBOL TAHMİNLERİ · ÜYE MERKEZİ</p><h1>Tahmin Merkezi</h1><span>Merhaba {name}. {planMessage(plan)}</span></div><div className={styles.quick}><Link href="/member/predictions">Tüm Tahminler</Link>{!preview?<Link href="/member/messages">Mesajlar</Link>:null}<Link href={plansHref}>Paketim</Link></div></section>
      <section className={dashboard.metrics}><article><span>▣</span><div><small>Yaklaşan maç</small><strong>{predictions.length}</strong></div></article><article><span>♢</span><div><small>Yüksek güven</small><strong>{strong.length}</strong></div></article><article><span>▥</span><div><small>Ortalama güven</small><strong>%{average.toFixed(0)}</strong></div></article><article><span>◎</span><div><small>Ortalama tahmin</small><strong>%{averagePrediction.toFixed(0)}</strong></div></article><article><span>♟</span><div><small>Açık pazar</small><strong>{MEMBERSHIP_PLAN_MARKET_LIMITS[plan]}</strong></div></article></section>
      <div className={dashboard.layout}>
        <section className={dashboard.predictionPanel}><header><div><h2>EN GÜÇLÜ TAHMİNLER</h2><p>En güçlü yaklaşan maçlar</p></div><Link href="/member/predictions">Tüm tahminler →</Link></header><div className={dashboard.matchList}>{featured.length?featured.map(item=><MemberPredictionRow prediction={item} plan={plan} href={matchHref(item.matchId)} key={item.matchId}/>):<div className={dashboard.empty}>Yeni tahminler veri işlemi tamamlandığında burada görünür.</div>}</div></section>
        <aside className={dashboard.side}>
          <section className={dashboard.featured}><header><span>★</span><div><h2>BUGÜNÜN ÖNE ÇIKANI</h2><p>En güçlü yaklaşan tahmin</p></div></header>{strongest?<><div className={dashboard.featuredTeam}><TeamLogo src={strongest.predictedOutcome==="AWAY"?strongest.awayTeamLogo:strongest.homeTeamLogo} name={strongest.predictedOutcome==="AWAY"?strongest.awayTeam:strongest.homeTeam}/><div><strong>{strongest.predictedOutcome==="AWAY"?strongest.awayTeam:strongest.homeTeam}</strong><span>{outcomeLabel(strongest)}</span></div><b>GÜÇLÜ</b></div><div className={dashboard.featuredStats}><span>Güven <b>%{strongest.confidenceScore.toFixed(0)}</b></span><span>Oran <b>{plan!=="BASIC"?fairOdds(strongest).toFixed(2):"🔒"}</b></span><span>xG <b>{plan==="PROFESSIONAL"?(strongest.expectedHomeGoals+strongest.expectedAwayGoals).toFixed(1):"🔒"}</b></span></div><Link href={matchHref(strongest.matchId)}>▥ &nbsp; Analizi Gör →</Link></>:<div className={dashboard.empty}>Veri bekleniyor</div>}</section>
          <section className={dashboard.strongOdds}><header><span>♢</span><div><h2>GÜÇLÜ 1.50+ SEÇİMLER</h2><p>Yüksek oranlı, güvenilir tahminler</p></div></header>{plan!=="BASIC"?<ol>{strong150.length?strong150.map((item,index)=><li key={item.matchId}><span>{index+1}</span><div><strong>{item.homeTeam} – {item.awayTeam}</strong><small>{outcomeLabel(item)}</small></div><b>{fairOdds(item).toFixed(2)}</b><em>%{item.confidenceScore.toFixed(0)}</em></li>):<li className={dashboard.noOdds}>1.50 üzeri güçlü seçim bulunamadı.</li>}</ol>:<div className={styles.upgrade}>Güçlü 1.50+ listesi Analiz ve Profesyonel üyelikte açılır.<Link href={plansHref}>Paketi yükselt →</Link></div>}</section>
          <section className={dashboard.modelStatus}><header><span>◉</span><h2>MODEL DURUMU</h2><b><i/> Canlı ve aktif</b></header><div><span>Üyelik <b>{MEMBERSHIP_PLAN_LABELS[plan]}</b></span><span>Açık pazar <b>{MEMBERSHIP_PLAN_MARKET_LIMITS[plan]}/27</b></span><span>Tüm sistemler <b>Aktif</b></span></div><aside>✓ <span><strong>Model normal çalışıyor</strong><small>Güncel verilerle tahmin üretiliyor.</small></span></aside></section>
        </aside>
      </div>
      <section className={styles.performance}><header><div><small>GERÇEKLEŞMİŞ SONUÇLAR · TÜM BAHİS PAZARLARI</small><h2>Güçlü, Orta ve Zayıf seçimlerin tutma oranı</h2></div><p>Her maçtaki 27 pazarın en güçlü seçimi; yalnız doğrulanabilen sonuçlar oran hesabına katılır.</p></header><div>{([['Güçlü',performance?.strong],['Orta',performance?.medium],['Zayıf',performance?.weak]] as const).map(([label,item])=><article data-level={label} key={label}><span>{label}</span><strong>{item?.rate===null||item===undefined?'—':`%${item.rate.toFixed(1)}`}</strong><i><b style={{width:`${item?.rate??0}%`}}/></i><div className={styles.performanceStats}><span><b>{item?.wins??0}</b>Kazandı</span><span><b>{item?.losses??0}</b>Kaybetti</span><span><b>{item?.samples??0}</b>Değerlendirildi</span></div><small>Toplam {item?.total??0} pazar seçimi{item?.voids?` · ${item.voids} iade`:''}{item?.unavailable?` · ${item.unavailable} veri bekliyor`:''}</small></article>)}</div></section>
      <section className={styles.scope}><div><small>PAKETİNİZ</small><h2>{MEMBERSHIP_PLAN_LABELS[plan]} üyelik kapsamı</h2><p>{MEMBERSHIP_PLAN_MARKET_LIMITS[plan]} pazar erişimi aktif. Mevcut paket haklarınız ve bütün bağlantılar korundu.</p></div><Link href={plansHref}>{plan==="PROFESSIONAL"?"Paket ayrıntıları":"Paketleri karşılaştır"}</Link></section>
      <footer className={dashboard.footer}><b>WINIQ</b><span>Veriyi görün, kararınızı kendiniz verin.</span><small>Tahminler bilgi amaçlıdır; kupon veya kazanç garantisi sunulmaz.</small></footer>
    </div>
  </main>;
}
