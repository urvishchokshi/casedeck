import { PageTitle } from "@/components/PageTitle";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import type { MatchProfile, ModePref, Profile } from "@/lib/types";
import { MyMatchCard } from "./MyMatchCard";
import { RevealWhatsApp } from "./RevealWhatsApp";

export const metadata = { title: "Partner matching" };

interface MatchRow extends MatchProfile {
  profile: Pick<Profile, "full_name" | "email">;
}

const MODE_LABELS: Record<ModePref, string> = {
  online: "Online",
  offline: "Offline",
  both: "Online or offline",
};

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
    <>
      <PageTitle plain="Find a " accent="Partner" />

      <MyMatchCard profile={mine ? stripEmbed(mine) : null} />

      <div className="flex flex-col rounded-[20px] bg-[var(--card)] p-1.5 [box-shadow:var(--sh)]">
        <div className="flex flex-col items-center gap-3 px-4 pb-4 pt-[18px]">
          <span className="text-[22px] font-bold tracking-[-0.02em] text-[var(--heading)]">
            {others.length}{" "}
            <span className="text-[var(--accent)]">
              partner{others.length === 1 ? "" : "s"}
            </span>
          </span>
        </div>

        {others.length === 0 ? (
          <div className="grid place-items-center px-6 pb-16 pt-8 text-center">
            <div>
              <p className="text-[17px] font-semibold text-[var(--ink)]">
                No cards yet — be the first
              </p>
              <p className="mt-1 text-[14px] text-[var(--muted)]">
                Add your card above and other students will find you here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-4 px-3 pb-4 max-desk:grid-cols-1">
            {others.map((row) => (
              <PartnerCard key={row.user_id} row={row} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function stripEmbed(row: MatchRow): MatchProfile {
  const { profile, ...rest } = row;
  void profile;
  return rest;
}

function PartnerCard({ row }: { row: MatchRow }) {
  const name = displayNameOf(row);
  const available = row.status === "available";

  return (
    <div className="flex flex-col gap-[18px] rounded-[var(--r)] border border-[var(--line-card)] bg-[var(--card)] p-[22px] transition-[border-color,box-shadow] [box-shadow:var(--sh)] hover:border-[var(--line-card-hover)] hover:[box-shadow:var(--sh-card-hover)]">
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h2
            className="truncate text-[19px] tracking-[-0.015em]"
            title={name}
          >
            {name}
          </h2>
          <span className="flex-none whitespace-nowrap text-[13px] text-[var(--muted-2)]">
            · {row.campus}
          </span>
        </div>
        <Pill tone={available ? "done" : "revisit"} className="flex-none">
          <span
            aria-hidden
            className="h-[6px] w-[6px] rounded-full"
            style={{
              background: available ? "var(--done-dot)" : "var(--revisit-dot)",
            }}
          />
          {available ? "Available" : "Busy"}
        </Pill>
      </div>

      <div className="flex flex-col gap-[9px] border-t border-[var(--line-inner)] pt-3.5">
        <div className="flex items-center justify-between gap-2.5">
          <span className="flex-none text-[13px] text-[var(--muted)]">
            Industry
          </span>
          <span className="truncate text-right text-[13.5px] font-semibold text-[var(--heading)]">
            {row.workex_industry}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2.5">
          <span className="flex-none text-[13px] text-[var(--muted)]">
            Job function
          </span>
          <span className="truncate text-right text-[13.5px] font-semibold text-[var(--heading)]">
            {row.workex_function}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2.5">
          <span className="flex-none text-[13px] text-[var(--muted)]">
            Prefers
          </span>
          <span className="whitespace-nowrap text-[13.5px] font-semibold text-[var(--heading)]">
            {MODE_LABELS[row.mode_preference]}
          </span>
        </div>
      </div>

      <div className="mt-auto">
        <RevealWhatsApp number={row.whatsapp_number} />
      </div>
    </div>
  );
}
