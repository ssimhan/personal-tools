import Link from "next/link";
import { requireUser, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Nav } from "./_components/nav";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 h-14">
          <Link href="/" className="font-semibold tracking-tight flex items-center gap-2 shrink-0">
            <span className="inline-block h-3 w-3 rounded-full bg-[#00ff00]" aria-hidden />
            CRM
          </Link>
          <Nav signOut={signOut} />
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
