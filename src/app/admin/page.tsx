import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth-session";

/** System health hub folded into Operations. */
export default async function AdminSystemHealthPage() {
  await requireAdmin();
  redirect("/operations");
}
