import Link from "next/link";

import { AdminMessageReply } from "@/components/admin-message-reply";
import { PageShell } from "@/components/page-shell";
import { prisma } from "@/lib/prisma";

type Filter = "all" | "waiting" | "answered";
function filterValue(value: string | string[] | undefined): Filter {
  const item = Array.isArray(value) ? value[0] : value;
  return item === "waiting" || item === "answered" ? item : "all";
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ filter?: string | string[]; user?: string | string[] }> }) {
  const query = await searchParams;
  const filter = filterValue(query.filter);
  const requestedUser = Array.isArray(query.user) ? query.user[0] : query.user;
  const members = await prisma.appUser.findMany({
    where: { role: "MEMBER", supportMessages: { some: {} } },
    select: { id: true, name: true, email: true, plan: true, supportMessages: { orderBy: { createdAt: "asc" }, take: 300 } },
  });
  const threads = members.map((member) => {
    const latest = member.supportMessages.at(-1)!;
    return { ...member, latest, waiting: latest.sender === "MEMBER", unread: member.supportMessages.filter((message) => message.sender === "MEMBER" && !message.readByAdmin).length };
  }).sort((a, b) => b.latest.createdAt.getTime() - a.latest.createdAt.getTime());
  const visible = threads.filter((thread) => filter === "all" || (filter === "waiting" ? thread.waiting : !thread.waiting));
  const selected = visible.find((thread) => thread.id === requestedUser) ?? visible[0];
  const waitingCount = threads.filter((thread) => thread.waiting).length;
  const answeredCount = threads.length - waitingCount;

  return <PageShell><header className="topbar dashboard-topbar"><div><p className="eyebrow">MEMBER COMMUNICATION</p><h1>Üye mesajları</h1><p className="subtitle">Cevap bekleyen üyeleri seçin, konuşma geçmişini inceleyin ve doğrudan yanıtlayın.</p></div><div className="message-admin-count"><strong>{waitingCount}</strong><span>cevap bekliyor</span></div></header>
    <div className="admin-message-filters">
      <Link className={filter === "all" ? "active" : ""} href="/admin/messages?filter=all">Tümü <b>{threads.length}</b></Link>
      <Link className={filter === "waiting" ? "active waiting" : "waiting"} href="/admin/messages?filter=waiting">Cevap bekleyen <b>{waitingCount}</b></Link>
      <Link className={filter === "answered" ? "active answered" : "answered"} href="/admin/messages?filter=answered">Cevaplanan <b>{answeredCount}</b></Link>
    </div>
    <section className="admin-message-layout">
      <aside className="admin-thread-list">
        {visible.length === 0 ? <p>Bu filtrede mesaj bulunmuyor.</p> : visible.map((thread) => <Link className={selected?.id === thread.id ? "active" : ""} href={`/admin/messages?filter=${filter}&user=${thread.id}`} key={thread.id}>
          <div><strong>{thread.name}</strong><span className={thread.waiting ? "message-status waiting" : "message-status answered"}>{thread.waiting ? "Cevap bekliyor" : "Cevaplandı"}</span></div>
          <small>{thread.email}</small><p>{thread.latest.body}</p><footer><time>{thread.latest.createdAt.toLocaleString("tr-TR")}</time>{thread.unread ? <b>{thread.unread} yeni</b> : null}</footer>
        </Link>)}
      </aside>
      <div className="admin-conversation">
        {!selected ? <div className="message-empty"><strong>Konuşma seçilmedi</strong><span>Mesajları görmek için soldan bir üye seçin.</span></div> : <>
          <header><div><strong>{selected.name}</strong><span>{selected.email} · {selected.plan}</span></div><span className={selected.waiting ? "message-status waiting" : "message-status answered"}>{selected.waiting ? "Cevap bekliyor" : "Cevaplandı"}</span></header>
          <div className="admin-conversation-messages">{selected.supportMessages.map((message) => <article className={message.sender === "ADMIN" ? "message-bubble message-bubble-admin" : "message-bubble message-bubble-member"} key={message.id}><div><strong>{message.sender === "ADMIN" ? "Siz" : selected.name}</strong><time>{message.createdAt.toLocaleString("tr-TR")}</time></div><p>{message.body}</p></article>)}</div>
          <AdminMessageReply userId={selected.id} />
        </>}
      </div>
    </section>
  </PageShell>;
}
