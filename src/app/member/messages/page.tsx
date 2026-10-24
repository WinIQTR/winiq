import { MemberMessageCenter } from "@/components/member-message-center";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { requireMember } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberMessagesPage() {
  const user = await requireMember();
  const messages = await prisma.supportMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 300,
  });
  const waiting = messages.at(-1)?.sender === "MEMBER";

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="messages" />
      <div className={member.page}>
        <section className={member.welcome}>
          <div>
            <p data-no-translate>WINIQ · MESAJLAR</p>
            <h1>Destek iletişimi</h1>
            <span>Destek ekibiyle güvenli biçimde yazışın.</span>
          </div>
          <div className={member.quick}>
            <span className={waiting ? "message-status waiting" : "message-status answered"}>
              {waiting ? "Cevap bekliyor" : "Cevaplandı"}
            </span>
          </div>
        </section>
        <MemberMessageCenter
          messages={messages.map((message) => ({
            id: message.id,
            sender: message.sender,
            body: message.body,
            createdAt: message.createdAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}
