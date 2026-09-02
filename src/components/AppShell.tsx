"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { Brand } from "@/components/Brand";
import { createClient } from "@/lib/supabase/client";

export interface ShellUser {
  name: string;
  email: string;
  initials: string;
}

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Cases", href: "/cases" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Find a Partner", href: "/match" },
  { label: "Casebooks", href: "/casebooks" },
  { label: "Frameworks", href: "/frameworks" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {navItems.map(({ label, href }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-[var(--rs)] px-3 py-2 text-[13.5px] font-semibold transition-colors ${
              active
                ? "bg-[var(--accent-50)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:bg-[var(--thead)] hover:text-[var(--ink)]"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                active ? "bg-[var(--accent)]" : "bg-transparent"
              }`}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserSection({ user }: { user: ShellUser }) {
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full navigation so all server components re-render unauthenticated.
    window.location.assign("/login");
  };

  return (
    <div className="flex items-center gap-[9px] border-t border-[var(--line-soft)] px-[18px] pt-3.5">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[var(--amber-50)] text-[12px] font-bold text-[var(--amber)]">
        {user.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-[var(--ink)]">
          {user.name}
        </p>
        <p className="truncate text-[11px] font-medium text-[var(--muted)]">
          {user.email}
        </p>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        aria-label="Sign out"
        title="Sign out"
        className="shrink-0 rounded-[var(--rs)] p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--thead)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <LogOut size={15} />
      </button>
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[238px] flex-col border-r border-[var(--line)] bg-[var(--card)] py-5 lg:flex">
        <div className="px-[18px] pb-5">
          <Brand />
        </div>
        <div className="flex-1 px-3">
          <NavLinks />
        </div>
        <UserSection user={user} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-[var(--card)] px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-[var(--rs)] p-2 text-[var(--ink)] hover:bg-[var(--thead)]"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile slide-over drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={closeDrawer}
            className="absolute inset-0 bg-[var(--ink)]/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[var(--card)] py-5 shadow-xl">
            <div className="flex items-center justify-between px-[18px] pb-5">
              <Brand />
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close navigation menu"
                className="rounded-[var(--rs)] p-2 text-[var(--ink)] hover:bg-[var(--thead)]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 px-3">
              <NavLinks onNavigate={closeDrawer} />
            </div>
            <UserSection user={user} />
          </div>
        </div>
      )}

      <main className="px-4 py-8 sm:px-8 lg:ml-[238px] lg:px-[38px]">
        <div className="mx-auto max-w-[1360px]">{children}</div>
      </main>
    </div>
  );
}
