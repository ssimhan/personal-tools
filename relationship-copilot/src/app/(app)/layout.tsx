import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AuthenticationRequiredError, requireUser } from "@/infrastructure/auth/require-user";
import { createServerClient } from "@/infrastructure/supabase/server-client";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const client = await createServerClient();

  try {
    await requireUser(client);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/app">Relationship Copilot</Link>
        <span>Private workspace</span>
      </header>
      {children}
    </div>
  );
}
