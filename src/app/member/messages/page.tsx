import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MemberMessageCenter } from "@/components/member-message-center";
import { requireMember } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberMessagesPage() {
  const user = await requireMember();
  const messages = await prisma.supportMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 300 });
  const waiting = messages.at(-1)?.sender === "MEMBER";
  return <main className="member-shell member-messages-shell">
    <header className="member-header"><div><p className="member-eyebrow">ÜYE İLETİŞİM MERKEZİ</p><h1>Mesajlar</h1><p>Destek ekibimizle güvenli biçimde iletişim kurun.</p></div><div className="member-actions"><span className={waiting ? "message-status waiting" : "message-status answered"}>{waiting ? "Cevap bekliyor" : "Cevaplandı"}</span><LanguageSwitcher /><Link className="member-back-link" href="/member">Panele dön</Link></div></header>
    <MemberMessageCenter messages={messages.map((message) => ({ id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt.toISOString() }))} />
  </main>;
}
