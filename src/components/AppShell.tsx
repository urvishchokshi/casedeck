"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/Brand";
import { createClient } from "@/lib/supabase/client";

export interface ShellUser {
  name: string;
  email: string;
  initials: string;
}

export interface ShellCounts {
  cases: number;
  casebooks: number;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: keyof ShellCounts;
  soon?: boolean;
}

const iconProps = {
  width: 17,
  height: 17,
  viewBox: "0 0 20 20",
  fill: "none",
  className: "shrink-0",
} as const;

const navItems: NavItem[] = [
  {
    label: "Cases",
    href: "/cases",
    badge: "cases",
    icon: (
      <svg {...iconProps}>
        <rect x="2.5" y="4" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M2.5 8h15" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    label: "Casebooks",
    href: "/casebooks",
    badge: "casebooks",
    icon: (
      <svg {...iconProps}>
        <path d="M4 3.5h9a2 2 0 012 2V17H6a2 2 0 01-2-2V3.5z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4 13.5h11" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg {...iconProps}>
        <path d="M3.5 16V9M8.5 16V4M13.5 16v-5M18 16H2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Find a Partner",
    href: "/match",
    icon: (
      <svg {...iconProps}>
        <circle cx="8" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M2.5 17c.6-2.8 2.8-4.4 5.5-4.4S13 14.2 13.6 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M14 5.5a3 3 0 010 5.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Frameworks",
    href: "/frameworks",
    soon: true,
    icon: (
      <svg {...iconProps}>
        <rect x="2.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
        <rect x="11.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
        <rect x="2.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
        <rect x="11.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    label: "Guesstimates",
    href: "/guesstimates",
    soon: true,
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="2.5" width="13" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M6.5 6.5h7M7 10h.01M10 10h.01M13 10h.01M7 13.5h.01M10 13.5h.01M13 13.5h.01"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const COLLAPSE_KEY = "cd-nav-collapsed";

function ToggleIcon({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M8.5 5.5L13 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 5.5v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M11.5 5.5L7 10l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 5.5v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NavLinks({
  counts,
  collapsed,
  animateWidth,
  className = "",
  onNavigate,
}: {
  counts: ShellCounts;
  collapsed: boolean;
  animateWidth: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // Labels/badges collapse away only on desktop; the drawer always shows them.
  const labelClass = collapsed ? "desk:hidden" : "";

  return (
    <nav
      className={`flex flex-col gap-1 ${
        collapsed ? "desk:items-center" : ""
      } ${className}`}
    >
      {navItems.map(({ label, href, icon, badge, soon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex h-[42px] flex-none items-center gap-[11px] overflow-hidden rounded-xl px-3 text-[13.5px] ${
              animateWidth
                ? "transition-[width,color,background-color] desk:duration-[var(--t-slow)] desk:[transition-timing-function:var(--ease-in-out)]"
                : "transition-colors"
            } ${
              collapsed
                ? "desk:w-[42px] desk:justify-center desk:px-0"
                : "desk:w-full desk:px-[13px]"
            } ${
              active
                ? "bg-[var(--accent)] font-semibold text-[var(--on-accent)] [box-shadow:var(--sh-accent)]"
                : "text-[var(--muted)] hover:bg-[var(--nav-hover)]"
            }`}
          >
            {icon}
            <span
              className={`flex-1 whitespace-nowrap ${labelClass}`}
            >
              {label}
            </span>
            {badge !== undefined && (
              <span
                className={`text-[12px] ${labelClass} ${
                  active ? "opacity-85" : "text-[var(--faint)]"
                }`}
              >
                {counts[badge]}
              </span>
            )}
            {soon && (
              <span
                className={`text-[10.5px] font-bold ${labelClass} ${
                  active ? "opacity-90" : "text-[var(--faint)]"
                }`}
              >
                SOON
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileCard({
  user,
  collapsed,
  className = "",
}: {
  user: ShellUser;
  collapsed: boolean;
  className?: string;
}) {
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full navigation (not router.push) so every server component re-renders
    // unauthenticated and client state is dropped.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  };

  return (
    <div
      className={`flex flex-none items-center gap-[11px] rounded-2xl bg-[var(--card)] p-3 [box-shadow:var(--sh)] desk:mt-auto ${
        collapsed ? "desk:justify-center desk:p-2.5" : ""
      } ${className}`}
    >
      <span
        title={user.name}
        className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[var(--avatar)] text-[13px] font-bold text-[var(--slate)]"
      >
        {user.initials}
      </span>
      <div
        className={`min-w-0 flex-1 leading-[1.3] ${collapsed ? "desk:hidden" : ""}`}
      >
        <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]">
          {user.name}
        </p>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="text-[11.5px] text-[var(--muted-2)] transition-colors hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  counts,
  children,
}: {
  user: ShellUser;
  counts: ShellCounts;
  children: React.ReactNode;
}) {
  // Default expanded so SSR and first client render agree; the stored
  // preference applies after mount.
  const [collapsed, setCollapsed] = useState(false);
  // Width transitions are enabled only once the user toggles, so the
  // localStorage-driven collapse on mount stays instant (no glide on load).
  const [animateWidth, setAnimateWidth] = useState(false);
  // Mobile-only slide-out drawer (below desk:).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);
  const toggle = () => {
    setAnimateWidth(true);
    setCollapsed((c) => {
      window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    hamburgerRef.current?.focus();
  };

  return (
    <div
      className="min-h-dvh p-[clamp(12px,3vw,26px)]"
      style={{ background: "var(--canvas-grad)" }}
    >
      <div className="flex min-h-[calc(100dvh-2*clamp(12px,3vw,26px))] flex-col gap-4 rounded-[var(--r-shell)] bg-[var(--shell)] p-4 [box-shadow:var(--sh-shell)] desk:flex-row">
        <aside
          className={`flex w-full flex-none flex-col gap-2.5 desk:gap-[18px] ${
            collapsed ? "desk:w-[72px]" : "desk:w-[250px]"
          } ${
            animateWidth
              ? "desk:transition-[width] desk:duration-[var(--t-slow)] desk:[transition-timing-function:var(--ease-in-out)]"
              : ""
          }`}
        >
          <div
            className={`flex min-h-[32px] flex-none items-center justify-between gap-[9px] desk:px-1 desk:pt-1 ${
              collapsed
                ? "desk:flex-col desk:justify-center desk:gap-2.5 desk:px-0"
                : ""
            }`}
          >
            <Brand
              wordmarkClassName={`text-[16px] font-bold tracking-[-0.02em] ${
                collapsed ? "desk:hidden" : ""
              }`}
            />
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              className="-mr-1.5 grid h-11 w-11 flex-none place-items-center rounded-xl text-[var(--slate)] transition-colors hover:bg-[var(--nav-hover)] hover:text-[var(--accent)] desk:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 5.5h14M3 10h14M3 14.5h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={toggle}
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
              className="hidden h-8 w-8 flex-none place-items-center rounded-[9px] text-[var(--muted-2)] transition-colors hover:bg-[var(--nav-hover)] hover:text-[var(--accent)] desk:grid"
            >
              <ToggleIcon collapsed={collapsed} />
            </button>
          </div>

          <NavLinks
            counts={counts}
            collapsed={collapsed}
            animateWidth={animateWidth}
            className="max-desk:hidden"
          />

          <ProfileCard
            user={user}
            collapsed={collapsed}
            className="max-desk:hidden"
          />
        </aside>

        {drawerOpen && (
          <div
            className="cd-fade-in fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px] desk:hidden"
            onClick={closeDrawer}
          >
            <div
              ref={drawerRef}
              id="mobile-drawer"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              onClick={(e) => e.stopPropagation()}
              className="cd-slide-in-left flex h-full w-[280px] max-w-[85vw] flex-col gap-[18px] overflow-y-auto bg-[var(--shell)] p-4 outline-none [box-shadow:var(--sh-shell)]"
            >
              <div className="flex min-h-[32px] flex-none items-center justify-between gap-[9px] px-1 pt-1">
                <Brand wordmarkClassName="text-[16px] font-bold tracking-[-0.02em]" />
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Close menu"
                  className="-mr-1.5 grid h-11 w-11 flex-none place-items-center rounded-xl text-[var(--slate)] transition-colors hover:bg-[var(--nav-hover)] hover:text-[var(--accent)]"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M5 5l10 10M15 5L5 15"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <NavLinks
                counts={counts}
                collapsed={false}
                animateWidth={false}
                onNavigate={closeDrawer}
              />

              <ProfileCard user={user} collapsed={false} className="mt-auto" />
            </div>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col gap-4">{children}</main>
      </div>
    </div>
  );
}
