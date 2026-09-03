import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import type { MatchProfile, ModePref, Profile } from "@/lib/types";
import { MyMatchCard } from "./MyMatchCard";
import { RevealWhatsApp } from "./RevealWhatsApp";

interface MatchRow extends MatchProfile {
  profile: Pick<Profile, "full_name" | "email">;
}

const MODE_LABELS: Record<ModePref, string> = {
  online: "Online",
  offline: "Offline",
  both: "Both",
};

// Same shape as the non-exported helper in (app)/layout.tsx.
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase() || "?";
}

function displayNameOf(row: MatchRow): string {
  return row.profile.full_name?.trim() || row.profile.email.split("@")[0];
}

export default async function MatchPage() {
  const supabase = await createClient();
  // The (app) layout redirects unauthenticated visitors, so user is present;
  // the null guard just keeps this page from crashing if that ever changes.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("match_profiles")
    .select(
      "user_id, whatsapp_number, workex_function, workex_industry, campus, mode_preference, status, updated_at, profile:profiles!inner(full_name, email)"
    )
    .order("updated_at", { ascending: false });
  if (error) {
    throw new Error("Failed to load the partner board: " + error.message);
  }
  // The profiles embed confuses the inferred row type.
  const rows = (data ?? []) as unknown as MatchRow[];

  const mine = user ? (rows.find((r) => r.user_id === user.id) ?? null) : null;
  // Rows arrive updated_at desc; a stable sort on busy-ness keeps
  // newest-first within each group without relying on enum order in SQL.
  const others = rows
    .filter((r) => r.user_id !== user?.id)
    .sort((a, b) => Number(a.status === "busy") - Number(b.status === "busy"));

  return (
    <div>
      <PageHeader
        title="Find a partner"
        subtitle="Practicing with the same person every time builds blind spots — mix it up."
      />

      <MyMatchCard profile={mine ? stripEmbed(mine) : null} />

      {others.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <div>
            <p className="text-[17px] font-semibold text-[var(--ink)]">
              No cards yet — be the first
            </p>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Add your card above and other students will find you here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {others.map((row) => (
            <PartnerCard key={row.user_id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function stripEmbed(row: MatchRow): MatchProfile {
  const { profile: _profile, ...rest } = row;
  return rest;
}

function PartnerCard({ row }: { row: MatchRow }) {
  const name = displayNameOf(row);
  const available = row.status === "available";

  return (
    <Card className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-[11px]">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--amber-50)] text-[14px] font-bold text-[var(--amber)]">
            {initialsOf(name)}
          </span>
          <div>
            <h2 className="font-[family-name:var(--font-ui)] text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
              {name}
            </h2>
            <p className="text-[12px] font-medium text-[var(--muted)]">
              {row.workex_function} · {row.workex_industry}
            </p>
          </div>
        </div>
        <span className="mt-1 flex shrink-0 items-center gap-1.5">
          {/* Busy uses --amber (an active "occupied" signal), not the greyed
              --status-idle of the old placeholder — deliberate. */}
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              available ? "bg-[var(--status-active)]" : "bg-[var(--amber)]"
            }`}
          />
          <span className="text-[11.5px] font-semibold text-[var(--muted)]">
            {available ? "Available" : "Busy"}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill>{row.campus}</Pill>
        <Pill>{MODE_LABELS[row.mode_preference]}</Pill>
      </div>
      <RevealWhatsApp number={row.whatsapp_number} />
    </Card>
  );
}
