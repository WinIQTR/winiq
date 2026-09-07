"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminMessageReply({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => { void fetch("/api/admin/messages", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) }); }, [userId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    const response = await fetch("/api/admin/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, body }) });
    const result = await response.json() as { success: boolean; message: string };
    setStatus(result.message); setBusy(false);
    if (result.success) { form.reset(); router.refresh(); }
  }

  return <form className="admin-message-compose" onSubmit={submit}>
    <textarea name="body" minLength={2} maxLength={2000} rows={4} required placeholder="Üyeye yanıtınızı yazın…" />
    <div><span>{status}</span><button disabled={busy}>{busy ? "Gönderiliyor…" : "Yanıtı gönder"}</button></div>
  </form>;
}
