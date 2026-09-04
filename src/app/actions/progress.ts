"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OUTCOME_ORDER } from "@/lib/outcome";
import type { CaseOutcome } from "@/lib/types";

export type ProgressActionResult = { ok: true } | { ok: false; error: string };

const UPSERT_KEY = { onConflict: "user_id,case_id" } as const;

/**
 * Server actions are public POST endpoints — every input is validated here
 * and the user always comes from the session, never from an argument. RLS
 * (insert/update own rows only) is the second layer. There is no delete
 * policy on user_case_progress, so "undo" operations are updates.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getActionContext(caseId: unknown) {
  if (typeof caseId !== "string" || !UUID_RE.test(caseId)) {
    return { ok: false, error: "Invalid case." } as const;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." } as const;
  return { ok: true, supabase, user, caseId } as const;
}

function revalidateCaseViews(caseId: string) {
  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);
}

export async function logCase(
  caseId: string,
  outcome: CaseOutcome,
  qualityRating: number,
  selfScore: number
): Promise<ProgressActionResult> {
  const ctx = await getActionContext(caseId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!(OUTCOME_ORDER as readonly string[]).includes(outcome)) {
    return { ok: false, error: "Invalid outcome." };
  }
  // All three outcomes are an attempt, so both scores are always required;
  // ranges mirror the DB CHECKs.
  if (!Number.isInteger(qualityRating) || qualityRating < 1 || qualityRating > 5) {
    return { ok: false, error: "Case quality must be a rating from 1 to 5." };
  }
  if (!Number.isInteger(selfScore) || selfScore < 1 || selfScore > 10) {
    return { ok: false, error: "Performance must be a score from 1 to 10." };
  }

  // Omitting marked_for_later keeps its current value on the update path.
  // Writing quality_rating/outcome fires the trigger that recomputes the
  // case's avg_rating/rating_count.
  const { error } = await ctx.supabase.from("user_case_progress").upsert(
    {
      user_id: ctx.user.id,
      case_id: ctx.caseId,
      outcome,
      quality_rating: qualityRating,
      self_score: selfScore,
      // Re-saving refreshes this: completed_at tracks when the outcome was
      // last set, not the first log.
      completed_at: new Date().toISOString(),
    },
    UPSERT_KEY
  );
  if (error) return { ok: false, error: "Could not save. Please try again." };

  revalidateCaseViews(ctx.caseId);
  return { ok: true };
}

export async function clearOutcome(caseId: string): Promise<ProgressActionResult> {
  const ctx = await getActionContext(caseId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase.from("user_case_progress").upsert(
    {
      user_id: ctx.user.id,
      case_id: ctx.caseId,
      outcome: null,
      quality_rating: null,
      self_score: null,
      completed_at: null,
    },
    UPSERT_KEY
  );
  if (error) return { ok: false, error: "Could not save. Please try again." };

  revalidateCaseViews(ctx.caseId);
  return { ok: true };
}

export async function toggleMarkedForLater(
  caseId: string
): Promise<ProgressActionResult> {
  const ctx = await getActionContext(caseId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: existing, error: readError } = await ctx.supabase
    .from("user_case_progress")
    .select("marked_for_later")
    .eq("user_id", ctx.user.id)
    .eq("case_id", ctx.caseId)
    .maybeSingle();
  if (readError) {
    return { ok: false, error: "Could not save. Please try again." };
  }

  const { error } = await ctx.supabase.from("user_case_progress").upsert(
    {
      user_id: ctx.user.id,
      case_id: ctx.caseId,
      marked_for_later: !existing?.marked_for_later,
    },
    UPSERT_KEY
  );
  if (error) return { ok: false, error: "Could not save. Please try again." };

  revalidateCaseViews(ctx.caseId);
  return { ok: true };
}
