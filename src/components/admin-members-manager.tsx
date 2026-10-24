"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "@/app/admin/members/admin-members.module.css";
import { DEFAULT_MEMBERSHIP_PRICES } from "@/lib/membership-commerce";
import { MEMBERSHIP_PLAN_LABELS } from "@/lib/membership-access";
import type { MembershipPaymentSettings } from "@/lib/membership-payment-settings";

type MemberRow = {
  id: string;
  name: string;
  email: string;
  plan: "BASIC" | "ANALYSIS" | "PROFESSIONAL";
  status: "ACTIVE" | "SUSPENDED";
  membershipEndsAt: string | null;
  createdAt: string;
  sessionCount: number;
};

type UpgradeRequestRow = {
  id: string;
  userName: string;
  userEmail: string;
  currentPlan: "BASIC" | "ANALYSIS" | "PROFESSIONAL";
  requestedPlan: "BASIC" | "ANALYSIS" | "PROFESSIONAL";
  status: "PENDING" | "CONTACTED" | "APPROVED" | "REJECTED";
  memberNote: string | null;
  createdAt: string;
};

type PlanPriceRow = {
  plan: "BASIC" | "ANALYSIS" | "PROFESSIONAL";
  priceTry: number;
  priceEur: number;
};

async function send(method: "POST" | "PATCH", body: unknown) {
  const response = await fetch("/api/admin/members", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<{ success: boolean; message: string }>;
}

async function sendTo(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<{ success: boolean; message: string }>;
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}

export function AdminMembersManager({ members, upgradeRequests, prices, paymentSettings }: {
  members: MemberRow[];
  upgradeRequests: UpgradeRequestRow[];
  prices: PlanPriceRow[];
  paymentSettings: MembershipPaymentSettings;
}) {
  // upgradeRequests kept in props for callers; handled in unified inbox (/admin/messages?tab=upgrades)
  void upgradeRequests;
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [planFilter, setPlanFilter] = useState<"ALL" | MemberRow["plan"]>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberRow["status"]>("ALL");
  const [query, setQuery] = useState("");

  const filteredMembers = members.filter((member) => {
    if (planFilter !== "ALL" && member.plan !== planFilter) return false;
    if (statusFilter !== "ALL" && member.status !== statusFilter) return false;
    if (!query.trim()) return true;
    const hay = `${member.name} ${member.email}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await send("POST", Object.fromEntries(data));
    setMessage(result.message);
    setBusy(false);
    if (result.success) {
      form.reset();
      router.refresh();
    }
  }

  async function updateAccess(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await send("PATCH", { ...data, userId, action: "UPDATE_ACCESS" });
    setMessage(result.message);
    setBusy(false);
    if (result.success) router.refresh();
  }

  async function memberAction(userId: string, action: "REVOKE_SESSIONS" | "RESET_PASSWORD", password?: string) {
    setBusy(true);
    const result = await send("PATCH", { userId, action, password });
    setMessage(result.message);
    setBusy(false);
    if (result.success) router.refresh();
  }

  async function updatePrice(event: FormEvent<HTMLFormElement>, plan: PlanPriceRow["plan"]) {
    event.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = await sendTo("/api/admin/membership-prices", { ...values, plan });
    setMessage(result.message);
    setBusy(false);
    if (result.success) router.refresh();
  }

  return (
    <div className={styles.workspace}>
      {message ? <div className={styles.message}>{message}</div> : null}

      <section className={styles.panel}>
        <div className={styles.heading}>
          <div>
            <h2>Gelen kutusu</h2>
            <p>
              Mesajlar ve yükseltme talepleri tek yerde:{" "}
              <a href="/admin/messages">Gelen kutusu</a>
              {upgradeRequests.length ? ` · ${upgradeRequests.length} yükseltme bekliyor` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Yeni üye oluştur</h2>
        <p>Açık kayıt yoktur. Yeni hesaplar yalnızca buradan oluşturulur.</p>
        <form className={styles.createForm} onSubmit={createMember}>
          <label>Ad<input name="name" required /></label>
          <label>E-posta<input name="email" type="email" required /></label>
          <label>Paket<select name="plan" defaultValue="BASIC"><option value="BASIC">Temel</option><option value="ANALYSIS">Analiz</option><option value="PROFESSIONAL">Profesyonel</option></select></label>
          <label>Bitiş tarihi<input name="membershipEndsAt" type="date" /></label>
          <label className={styles.wide}>Geçici şifre<input name="password" type="password" minLength={12} required /></label>
          <button disabled={busy}>Üye oluştur</button>
        </form>
      </section>

      <section className={`${styles.panel} ${styles.paymentPanel}`}>
        <div className={styles.heading}>
          <div><span className={styles.eyebrow}>ÖDEME MERKEZİ</span><h2>Ödeme bağlantıları</h2><p>Üyelerin paket ekranında görünen Türkiye ve yurt dışı ödeme kanalları.</p></div>
          <span className={styles.paymentCount}>{[paymentSettings.ininalUrl, paymentSettings.wiseUrl, paymentSettings.bankIban].filter(Boolean).length}/3 aktif</span>
        </div>
        <div className={styles.paymentGrid}>
          <article className={paymentSettings.ininalUrl ? styles.paymentActive : styles.paymentWaiting}><div><b>İninal</b><span>Türkiye · Sanal POS / ödeme bağlantısı</span></div><strong>{paymentSettings.ininalUrl ? "AKTİF" : "KURULUM BEKLİYOR"}</strong><small>ININAL_PAYMENT_URL</small></article>
          <article className={paymentSettings.bankIban ? styles.paymentActive : styles.paymentWaiting}><div><b>Banka havalesi</b><span>Türkiye · TL hesabı</span></div><strong>{paymentSettings.bankIban ? "AKTİF" : "KURULUM BEKLİYOR"}</strong><small>BANK_TRANSFER_IBAN + PAYMENT_ACCOUNT_NAME</small></article>
          <article className={paymentSettings.wiseUrl ? styles.paymentActive : styles.paymentWaiting}><div><b>Wise</b><span>Yurt dışı · EUR ödeme bağlantısı</span></div><strong>{paymentSettings.wiseUrl ? "AKTİF" : "KURULUM BEKLİYOR"}</strong><small>WISE_PAYMENT_URL</small></article>
        </div>
        <div className={styles.paymentFlow}><span><b>1</b> Üye paketini seçer</span><i>→</i><span><b>2</b> Talep ve referans oluşur</span><i>→</i><span><b>3</b> Ödeme yapılır</span><i>→</i><span><b>4</b> Siz onaylayıp üyeliği açarsınız</span></div>
      </section>

      <section className={styles.panel}>
        <h2>Paket fiyatları</h2>
        <p>Sıfır değer, fiyatın henüz kullanıcıya yayınlanmadığını belirtir.</p>
        <div className={styles.priceGrid}>
          {(["BASIC", "ANALYSIS", "PROFESSIONAL"] as const).map((plan) => {
            const price = prices.find((item) => item.plan === plan);
            return (
              <form key={plan} className={styles.priceCard} onSubmit={(event) => updatePrice(event, plan)}>
                <strong>{MEMBERSHIP_PLAN_LABELS[plan]}</strong>
                <small>Önerilen: {DEFAULT_MEMBERSHIP_PRICES[plan].priceTryCents / 100} TL · €{DEFAULT_MEMBERSHIP_PRICES[plan].priceEurCents / 100}</small>
                <label>TL / ay<input name="priceTry" type="number" min="0" step="0.01" defaultValue={price?.priceTry || DEFAULT_MEMBERSHIP_PRICES[plan].priceTryCents / 100} /></label>
                <label>EUR / ay<input name="priceEur" type="number" min="0" step="0.01" defaultValue={price?.priceEur || DEFAULT_MEMBERSHIP_PRICES[plan].priceEurCents / 100} /></label>
                <button disabled={busy}>Fiyatı kaydet</button>
              </form>
            );
          })}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.heading}><div><h2>Üyeler</h2><p>{filteredMembers.length} / {members.length} kayıt</p></div></div>
        <div className={styles.createForm} style={{ marginBottom: 16 }}>
          <label>Ara<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ad veya e-posta" /></label>
          <label>Paket
            <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value as typeof planFilter)}>
              <option value="ALL">Tümü</option>
              <option value="BASIC">Temel</option>
              <option value="ANALYSIS">Analiz</option>
              <option value="PROFESSIONAL">Profesyonel</option>
            </select>
          </label>
          <label>Durum
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="ALL">Tümü</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </label>
        </div>
        <div className={styles.memberList}>
          {filteredMembers.length === 0 ? <p className={styles.empty}>Filtreye uyan üye yok.</p> : filteredMembers.map((member) => {
            const left = daysLeft(member.membershipEndsAt);
            const expiring = left !== null && left <= 7;
            return (
            <article className={styles.memberCard} key={member.id} style={expiring ? { borderColor: "#f4bd45" } : undefined}>
              <div className={styles.identity}>
                <strong>{member.name}</strong><span>{member.email}</span><b className={styles.memberPlanBadge}>{MEMBERSHIP_PLAN_LABELS[member.plan]} üyelik</b>
                <small>
                  Kayıt: {new Date(member.createdAt).toLocaleDateString("tr-TR")} · Aktif oturum: {member.sessionCount}
                  {left === null ? " · Bitiş yok" : left < 0 ? " · Süresi dolmuş" : ` · ${left} gün kaldı`}
                  {expiring ? " · UYARI" : ""}
                </small>
              </div>
              <form className={styles.accessForm} onSubmit={(event) => updateAccess(event, member.id)}>
                <label>Paket<select name="plan" defaultValue={member.plan}><option value="BASIC">Temel</option><option value="ANALYSIS">Analiz</option><option value="PROFESSIONAL">Profesyonel</option></select></label>
                <label>Durum<select name="status" defaultValue={member.status}><option>ACTIVE</option><option>SUSPENDED</option></select></label>
                <label>Bitiş<input name="membershipEndsAt" type="date" defaultValue={member.membershipEndsAt?.slice(0, 10) ?? ""} /></label>
                <button disabled={busy}>Kaydet</button>
              </form>
              <div className={styles.securityActions}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const base = member.membershipEndsAt ? new Date(member.membershipEndsAt) : new Date();
                    if (base.getTime() < Date.now()) base.setTime(Date.now());
                    base.setDate(base.getDate() + 30);
                    void send("PATCH", {
                      userId: member.id,
                      action: "UPDATE_ACCESS",
                      plan: member.plan,
                      status: member.status,
                      membershipEndsAt: base.toISOString().slice(0, 10),
                    }).then((result) => {
                      setMessage(result.message);
                      if (result.success) router.refresh();
                    });
                  }}
                >
                  +30 gün uzat
                </button>
                <input id={`password-${member.id}`} type="password" placeholder="Yeni şifre (12+ karakter)" minLength={12} />
                <button disabled={busy} onClick={() => {
                  const input = document.getElementById(`password-${member.id}`) as HTMLInputElement | null;
                  void memberAction(member.id, "RESET_PASSWORD", input?.value);
                }}>Şifreyi yenile</button>
                <button disabled={busy} onClick={() => void memberAction(member.id, "REVOKE_SESSIONS")}>Oturumları kapat</button>
              </div>
            </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
