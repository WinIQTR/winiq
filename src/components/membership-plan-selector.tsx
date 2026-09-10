"use client";

import { useState } from "react";
import type { MembershipPaymentSettings } from "@/lib/membership-payment-settings";

type Plan = "BASIC" | "ANALYSIS" | "PROFESSIONAL";

export function MembershipPlanSelector({
  requestedPlan, priceTry, priceEur, payment, memberReference,
}: {
  requestedPlan: Plan;
  priceTry: string;
  priceEur: string;
  payment: MembershipPaymentSettings;
  memberReference: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const paymentReference = `WINIQ-${requestedPlan}-${memberReference}`;

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1800);
  }

  async function requestUpgrade() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/member/upgrade-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestedPlan }),
    });
    const result = await response.json() as { success: boolean; message: string };
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <div className="member-upgrade-action">
      <button type="button" disabled={busy} onClick={() => void requestUpgrade()}>
        {busy ? "Gönderiliyor…" : "Yükseltme talebi gönder"}
      </button>
      {message ? <span role="status">{message}</span> : null}
      <div className="member-payment-box">
        <div className="member-payment-heading">
          <strong>Ödeme yöntemleri</strong>
          <small>Önce talebi gönderin, ardından ödemenizi yapın.</small>
        </div>
        <div className="member-payment-methods">
          {payment.ininalUrl ? <a href={payment.ininalUrl} target="_blank" rel="noreferrer"><b>İninal</b><span>Türkiye · {priceTry}</span></a> : null}
          {payment.wiseUrl ? <a href={payment.wiseUrl} target="_blank" rel="noreferrer"><b>Wise</b><span>Yurt dışı · {priceEur}</span></a> : null}
          {payment.bankIban ? <button type="button" onClick={() => void copy(payment.bankIban!, "IBAN")}><b>Banka havalesi</b><span>{copied === "IBAN" ? "IBAN kopyalandı" : `${priceTry} · IBAN’ı kopyala`}</span></button> : null}
        </div>
        {payment.bankIban ? <div className="member-bank-details">
          <span><small>Alıcı</small><b>{payment.accountName ?? "Yönetici tarafından bildirilecek"}</b></span>
          <span><small>Açıklama</small><button type="button" onClick={() => void copy(paymentReference, "reference")}>{copied === "reference" ? "Kopyalandı" : paymentReference}</button></span>
        </div> : null}
        {!payment.ininalUrl && !payment.wiseUrl && !payment.bankIban ? <small className="member-payment-pending">Ödeme bağlantıları yönetici tarafından hazırlanıyor.</small> : null}
      </div>
    </div>
  );
}
