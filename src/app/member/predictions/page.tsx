import { redirect } from "next/navigation";

import { requireMember } from "@/lib/auth-session";

/** Match calendar merged into /member date filters. */
export default async function MemberPredictionsPage() {
  await requireMember();
  redirect("/member");
}
