"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Library,
  Menu,
  Shapes,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Cases", href: "/cases", icon: BookOpen },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Find a Partner", href: "/match", icon: Users },
  { label: "Casebooks", href: "/casebooks", icon: Library },
  { label: "Frameworks", href: "/frameworks", icon: Shapes },
];

function Wordmark() {
  return (
    <span className="text-[length:var(--font-size-lg)] font-bold tracking-tight text-[var(--color-accent)]">
      CasePrep
    </span>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-[length:var(--font-size-sm)] font-medium transition-colors ${
              active
                ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-text)]"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserSection() {
  return (
    <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-accent-soft)] text-[length:var(--font-size-sm)] font-semibold text-[var(--color-accent)]">
        S
      </span>
      <div className="min-w-0">
        <p className="truncate text-[length:var(--font-size-sm)] font-medium text-[var(--color-text)]">
          Student
        </p>
        <p className="truncate text-[length:var(--font-size-xs)] text-[var(--color-text-muted)]">
          ISB Co&apos;27
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:flex">
        <div className="px-3 py-2">
          <Wordmark />
        </div>
        <div className="mt-6 flex-1">
          <NavLinks />
        </div>
        <UserSection />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 lg:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-[var(--radius-control)] p-2 text-[var(--color-text)] hover:bg-[var(--color-accent-soft)]"
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
            className="absolute inset-0 bg-[var(--color-text)]/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[var(--color-surface)] p-4 shadow-xl">
            <div className="flex items-center justify-between px-3 py-2">
              <Wordmark />
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close navigation menu"
                className="rounded-[var(--radius-control)] p-2 text-[var(--color-text)] hover:bg-[var(--color-accent-soft)]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex-1">
              <NavLinks onNavigate={closeDrawer} />
            </div>
            <UserSection />
          </div>
        </div>
      )}

      <main className="px-4 py-8 sm:px-8 lg:ml-60 lg:px-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
