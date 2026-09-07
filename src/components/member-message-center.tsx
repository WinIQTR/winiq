"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MessageRow = { id: string; sender: "MEMBER" | "ADMIN"; body: string; createdAt: string };

export function MemberMessageCenter({ messages }: { messages: MessageRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => { void fetch("/api/member/messages", { method: "PATCH" }); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setStatus("");
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    const response = await fetch("/api/member/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    const result = await response.json() as { success: boolean; message: string };
    setStatus(result.message); setBusy(false);
    if (result.success) { form.reset(); router.refresh(); }
  }

  return <div className="message-center">
    <section className="message-thread" aria-label="Mesaj geçmişi">
      {messages.length === 0 ? <div className="message-empty"><strong>Henüz mesajınız yok</strong><span>Sorularınızı veya destek taleplerinizi aşağıdaki alandan gönderebilirsiniz.</span></div> : messages.map((message) => (
        <article className={message.sender === "MEMBER" ? "message-bubble message-bubble-member" : "message-bubble message-bubble-admin"} key={message.id}>
          <div><strong>{message.sender === "MEMBER" ? "Siz" : "Destek ekibi"}</strong><time>{new Date(message.createdAt).toLocaleString("tr-TR")}</time></div>
          <p>{message.body}</p>
        </article>
      ))}
    </section>
    <form className="message-compose" onSubmit={submit}>
      <div><strong>Yeni mesaj</strong><span>Üyelik, ödeme veya analizlerle ilgili sorunuzu yazın.</span></div>
      <textarea name="body" minLength={3} maxLength={2000} rows={5} required placeholder="Mesajınızı yazın…" />
      <div className="message-compose-footer"><small>En fazla 2.000 karakter</small><button disabled={busy}>{busy ? "Gönderiliyor…" : "Mesajı gönder"}</button></div>
      {status ? <p className="message-form-status" role="status">{status}</p> : null}
    </form>
  </div>;
}
