"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/app/admin/members/admin-members.module.css";

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

export function AdminUpgradeInbox({ upgradeRequests }: { upgradeRequests: UpgradeRequestRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function resolveUpgrade(
    form: HTMLFormElement,
    requestId: string,
    action: "CONTACTED" | "APPROVE" | "REJECT",
  ) {
    setBusy(true);
    const values = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/admin/upgrade-requests", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, requestId, action }),
    });
    const result = (await response.json()) as { success: boolean; message: string };
    setMessage(result.message);
    setBusy(false);
    if (result.success) router.refresh();
  }

  return (
    <section className={styles.panel}>
      {message ? <div className={styles.message}>{message}</div> : null}
      <div className={styles.heading}>
        <div>
          <h2>Yükseltme talepleri</h2>
          <p>{upgradeRequests.length} aktif talep</p>
        </div>
      </div>
      <div className={styles.requestList}>
        {upgradeRequests.length === 0 ? (
          <p className={styles.empty}>Bekleyen yükseltme talebi yok.</p>
        ) : (
          upgradeRequests.map((request) => (
            <article className={styles.requestCard} key={request.id}>
              <div className={styles.identity}>
                <strong>{request.userName}</strong>
                <span>{request.userEmail}</span>
                <small>
                  {request.currentPlan} → {request.requestedPlan} ·{" "}
                  {new Date(request.createdAt).toLocaleDateString("tr-TR")}
                </small>
                {request.memberNote ? <p>{request.memberNote}</p> : null}
              </div>
              <form
                className={styles.requestForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  void resolveUpgrade(event.currentTarget, request.id, "APPROVE");
                }}
              >
                <label>
                  Süre (tek tık)
                  <select name="duration" defaultValue="">
                    <option value="">Not’tan / tarih</option>
                    <option value="MONTHLY">+1 ay</option>
                    <option value="QUARTERLY">+3 ay</option>
                    <option value="YEARLY">+12 ay</option>
                  </select>
                </label>
                <label>
                  Yeni bitiş tarihi (opsiyonel)
                  <input name="membershipEndsAt" type="date" />
                </label>
                <label>
                  Yönetici notu
                  <input name="adminNote" maxLength={500} />
                </label>
                <button disabled={busy}>Ödemeyi onayla</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={(event) => {
                    if (event.currentTarget.form) {
                      void resolveUpgrade(event.currentTarget.form, request.id, "CONTACTED");
                    }
                  }}
                >
                  İletişime geçildi
                </button>
                <button
                  type="button"
                  className={styles.rejectButton}
                  disabled={busy}
                  onClick={(event) => {
                    if (event.currentTarget.form) {
                      void resolveUpgrade(event.currentTarget.form, request.id, "REJECT");
                    }
                  }}
                >
                  Reddet
                </button>
              </form>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
