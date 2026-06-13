"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const TABS = [
  { href: "/", label: "Search" },
  { href: "/feed", label: "Feed" },
  { href: "/broadcast", label: "Broadcast" },
];

export function Nav({ signOut }: { signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/people") : pathname.startsWith(href);
  const adminActive = pathname.startsWith("/admin") || pathname.startsWith("/import");
  const base = "rounded-md px-4 py-2 text-sm transition-colors whitespace-nowrap";

  return (
    <nav className="flex flex-1 items-center justify-evenly gap-1 sm:gap-2">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={isActive(t.href) ? "page" : undefined}
          className={`${base} ${
            isActive(t.href)
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}

      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`${base} inline-flex items-center gap-1 ${
            adminActive
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          }`}
        >
          Admin
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {menuOpen ? (
          <>
            {/* Click-away backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
            <div role="menu" className="absolute right-0 z-20 mt-1 min-w-40 rounded-md border bg-card p-1 shadow-md">
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block rounded-sm px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Admin
              </Link>
              <Link
                href="/import"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block rounded-sm px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Import
              </Link>
              <div className="my-1 border-t" />
              <form action={signOut}>
                <button
                  role="menuitem"
                  className="block w-full rounded-sm px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                >
                  Sign out
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </nav>
  );
}
