import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth-session";

/** UX #11 — akıllı seçimler Özel liste altında. */
export default async function SmartPicksPage() {
  await requireAdmin();
  redirect("/special");
}
