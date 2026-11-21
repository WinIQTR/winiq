import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth-session";

/** Mobile preview merged into member UI preview. */
export default async function AdminMobilePreviewPage() {
  await requireAdmin();
  redirect("/admin/members/preview?plan=PROFESSIONAL");
}
