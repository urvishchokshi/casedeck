"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CampusType, ModePref, PartnerStatus } from "@/lib/types";

export type MatchActionResult = { ok: true } | { ok: false; error: string };

export interface MatchProfileInput {
  whatsapp: string;
  workexFunction: string;
  workexIndustry: string;
  campus: string;
  mode: string;
  status: string;
}

/**
 * Server actions are public POST endpoints — every input is validated here
 * and the user always comes from the session, never from an argument. RLS
 * (insert/update/delete own row only) is the second layer.
 */
const CAMPUSES = ["Hyderabad", "Mohali"] as const satisfies readonly CampusType[];
const MODES = ["online", "offline", "both"] as const satisfies readonly ModePref[];
const STATUSES = ["available", "busy"] as const satisfies readonly PartnerStatus[];

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

// Optional leading +, then 8–15 digits — validated after stripping the
// spaces/dashes people naturally type; the normalized form is what's stored.
const WHATSAPP_RE = /^\+?\d{8,15}$/;

function normalizeWhatsapp(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.replace(/[\s-]/g, "");
  return WHATSAPP_RE.test(normalized) ? normalized : null;
}

const TEXT_MAX = 60;

function normalizeText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed && trimmed.length <= TEXT_MAX ? trimmed : null;
}

async function getActionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." } as const;
  return { ok: true, supabase, user } as const;
}

export async function upsertMatchProfile(
  input: MatchProfileInput
): Promise<MatchActionResult> {
  const ctx = await getActionUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const whatsapp = normalizeWhatsapp(input?.whatsapp);
  if (!whatsapp) {
    return {
      ok: false,
      error: "WhatsApp number must be 8–15 digits (optional leading +).",
    };
  }
  const workexFunction = normalizeText(input?.workexFunction);
  if (!workexFunction) {
    return {
      ok: false,
      error: `Work-ex function is required (max ${TEXT_MAX} characters).`,
    };
  }
  const workexIndustry = normalizeText(input?.workexIndustry);
  if (!workexIndustry) {
    return {
      ok: false,
      error: `Work-ex industry is required (max ${TEXT_MAX} characters).`,
    };
  }
  if (!isOneOf(input?.campus, CAMPUSES)) {
    return { ok: false, error: "Pick a campus." };
  }
  if (!isOneOf(input?.mode, MODES)) {
    return { ok: false, error: "Pick a practice mode." };
  }
  if (!isOneOf(input?.status, STATUSES)) {
    return { ok: false, error: "Pick a status." };
  }

  // updated_at is owned by the set_match_profiles_updated_at trigger (insert
  // gets the column default) — never written from here.
  const { error } = await ctx.supabase.from("match_profiles").upsert(
    {
      user_id: ctx.user.id,
      whatsapp_number: whatsapp,
      workex_function: workexFunction,
      workex_industry: workexIndustry,
      campus: input.campus,
      mode_preference: input.mode,
      status: input.status,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: "Could not save. Please try again." };

  revalidatePath("/match");
  return { ok: true };
}

export async function setStatus(status: string): Promise<MatchActionResult> {
  const ctx = await getActionUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!isOneOf(status, STATUSES)) {
    return { ok: false, error: "Pick a status." };
  }

  // .select() surfaces the 0-row case (card removed in another tab), which a
  // bare update would report as success.
  const { data, error } = await ctx.supabase
    .from("match_profiles")
    .update({ status })
    .eq("user_id", ctx.user.id)
    .select("user_id");
  if (error || !data?.length) {
    return { ok: false, error: "Could not save. Please try again." };
  }

  revalidatePath("/match");
  return { ok: true };
}

export async function deleteMatchProfile(): Promise<MatchActionResult> {
  const ctx = await getActionUser();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // Unlike setStatus, a 0-row delete is success: the card being already gone
  // is the state the user asked for.
  const { error } = await ctx.supabase
    .from("match_profiles")
    .delete()
    .eq("user_id", ctx.user.id);
  if (error) {
    return { ok: false, error: "Could not remove your card. Please try again." };
  }

  revalidatePath("/match");
  return { ok: true };
}
