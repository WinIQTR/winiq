import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth-session";

/** UX #11 — kupon performansı Kupon merkezine taşındı. */
export default async function CouponPerformancePage() {
  await requireAdmin();
  redirect("/coupons?view=performance");
}
