import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth-session";

export default async function MemberCouponsPage() {
  await requireMember();
  redirect("/member/predictions");
}
