import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth-session";

/** Marketing dashboard demoted — Predictions is the live home. */
export default async function AdminDashboardPage() {
  await requireAdmin();
  redirect("/predictions");
}
