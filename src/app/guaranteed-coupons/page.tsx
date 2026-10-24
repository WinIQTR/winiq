import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth-session";

/** UX #11 — garanti kuponlar Kupon merkezine taşındı. */
export default async function GuaranteedCouponsPage() {
  await requireAdmin();
  redirect("/coupons?view=guaranteed");
}
