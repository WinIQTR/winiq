import type { ReactNode } from "react";

import { AppSidebar } from "./app-sidebar";

import { requireAdmin } from "@/lib/auth-session";

type PageShellProps = {
  children: ReactNode;
};

export async function PageShell({
  children,
}: PageShellProps) {
  await requireAdmin();

  return (
    <main className="app-shell">
      <AppSidebar />

      <section className="main-content">
        {children}
      </section>
    </main>
  );
}
