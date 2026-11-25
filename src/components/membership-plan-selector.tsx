"use client";

import { useState } from "react";

import type { MembershipPaymentSettings } from "@/lib/membership-payment-settings";
import { SINGLE_MEMBERSHIP_PLAN } from "@/lib/membership-access";

type Plan = "BASIC" | "ANALYSIS" | "PROFESSIONAL";
type Duration = "MONTHLY" | "QUARTERLY" | "YEARLY";

export function MembershipPlanSelector({
  requestedPlan = SINGLE_MEMBERSHIP_PLAN,
  priceTry,
  priceEur,
  payment,
  memberReference,
  mode = "renew",
  durationOptions,
  hidePaymentBox = false,
}: {
  requestedPlan?: Plan;
  priceTry: string;
  priceEur: string;
  payment: MembershipPaymentSettings;
  memberReference: string;
  mode?: "renew" | "upgrade";
  durationOptions?: Array<{ value: Duration; label: string }>;
  /** When payment is rendered as a sibling card. */
  hidePaymentBox?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [duration, setDuration] = useState<Duration>("MONTHLY");
  const plan = SINGLE_MEMBERSHIP_PLAN;
  const paymentReference = `WINIQ-${plan}-${duration}-${memberReference}`;
  const options = durationOptions ?? [
    { value: "MONTHLY" as const, label: "1 aylık" },
    { value: "QUARTERLY" as const, label: "3 aylık" },
    { value: "YEARLY" as const, label: "12 aylık" },
  ];

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1800);
  }

  async function requestRenewal() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/member/upgrade-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestedPlan: plan,
        memberNote: `RENEW ${duration} (requestedPlan=${requestedPlan}; mode=${mode})`,
        duration,
      }),
    });
    const result = (await response.json()) as { success: boolean; message: string };
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <div className="member-upgrade-action">
      <label>
        Süre
        <select
          value={duration}
          onChange={(event) => setDuration(event.target.value as Duration)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" disabled={busy} onClick={() => void requestRenewal()}>
        {busy ? "Gönderiliyor…" : "Yenileme / uzatma talebi gönder"}
      </button>
      {message ? <span role="status">{message}</span> : null}
      {hidePaymentBox ? null : (
        <div className="member-payment-box">
          <div className="member-payment-heading">
            <strong>Ödeme yöntemleri</strong>
            <small>Önce talebi gönderin, ardından ödemenizi yapın.</small>
          </div>
          <div className="member-payment-methods">
            {payment.wiseUrl ? (
              <a href={payment.wiseUrl} target="_blank" rel="noreferrer">
                <b>Wise</b>
                <span>Yurt dışı · {priceEur}</span>
              </a>
            ) : null}
            {payment.bankIban ? (
              <button type="button" onClick={() => void copy(payment.bankIban!, "IBAN")}>
                <b>Banka havalesi</b>
                <span>
                  {copied === "IBAN" ? "IBAN kopyalandı" : `${priceTry} · IBAN’ı kopyala`}
                </span>
              </button>
            ) : null}
          </div>
          {payment.bankIban ? (
            <div className="member-bank-details">
              <span>
                <small>Alıcı</small>
                <b>{payment.accountName ?? "Yönetici tarafından bildirilecek"}</b>
              </span>
              <span>
                <small>Açıklama</small>
                <button type="button" onClick={() => void copy(paymentReference, "reference")}>
                  {copied === "reference" ? "Kopyalandı" : paymentReference}
                </button>
              </span>
            </div>
          ) : null}
          {!payment.wiseUrl && !payment.bankIban ? (
            <small className="member-payment-pending">
              Ödeme bağlantıları yönetici tarafından hazırlanıyor.
            </small>
          ) : null}
        </div>
      )}
    </div>
  );
}
