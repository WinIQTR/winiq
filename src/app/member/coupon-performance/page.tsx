import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth-session";

export default async function MemberCouponPerformancePage() {
  await requireMember();
  redirect("/member/predictions");
}
