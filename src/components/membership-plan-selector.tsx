"use client";

import { useState } from "react";

type Plan = "BASIC" | "ANALYSIS" | "PROFESSIONAL";

export function MembershipPlanSelector({ requestedPlan }: { requestedPlan: Plan }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
    </div>
  );
}
