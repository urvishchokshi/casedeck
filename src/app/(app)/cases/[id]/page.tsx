import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageCard } from "@/components/ImageCard";
import { Pill } from "@/components/ui/Pill";
import { RatingPill } from "@/components/RatingPill";
import { createClient } from "@/lib/supabase/server";
import type { Case } from "@/lib/types";
import { Transcript } from "./Transcript";
import { CaseActions, type CaseProgressState } from "./CaseActions";

type CaseDetailRow = Case & { casebook: { name: string } | null };

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // Errors (including invalid-uuid 22P02) just leave data null → fallback.
  const { data } = await supabase
    .from("cases")
    .select("title")
    .eq("id", id)
    .maybeSingle<Pick<Case, "title">>();
  return { title: data?.title ?? "Case" };
}

/** "Beer Manufacturer" → ["Beer", "Manufacturer"]: lead + accent-blue last word. */
function splitTitle(title: string): [string, string] {
  const words = title.trim().split(/\s+/);
  const last = words.pop() ?? "";
  return [words.length > 0 ? words.join(" ") + " " : "", last];
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cases")
    .select("*, casebook:casebooks(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // 22P02 = invalid uuid text in the URL — treat as a missing case.
    if (error.code === "22P02") notFound();
    throw new Error(`Failed to load case: ${error.message}`);
  }
  if (!data) notFound();

  const c = data as unknown as CaseDetailRow;

  // The (app) layout redirects unauthenticated visitors; the guard is
  // belt-and-braces. RLS also scopes progress rows to the user.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let progress: CaseProgressState | null = null;
  if (user) {
    const { data: progressRow, error: progressError } = await supabase
      .from("user_case_progress")
      .select("outcome, self_score, quality_rating")
      .eq("user_id", user.id)
      .eq("case_id", id)
      .maybeSingle();
    if (progressError) {
      throw new Error(`Failed to load progress: ${progressError.message}`);
    }
    progress = progressRow;
  }

  const imagePaths = [...c.solution_image_urls, ...c.exhibit_image_urls];
  const signedByPath = new Map<string, string>();
  if (imagePaths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from("case-images")
      .createSignedUrls(imagePaths, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(
        `Failed to sign case-image URLs for case ${c.id}: ${signError.message}`
      );
    }
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) {
        signedByPath.set(item.path, item.signedUrl);
      }
    }
  }

  // When prompt is missing the first transcript turn stands in for it — drop
  // that turn from the transcript so it doesn't render twice.
  const promptText = c.prompt ?? c.transcript[0]?.text ?? null;
  const transcriptTurns = c.prompt ? c.transcript : c.transcript.slice(1);

  const [titleLead, titleLast] = splitTitle(c.title);

  return (
    // Matches the shell <main>'s flex column so the fade-up wrapper is
    // layout-neutral.
    <div className="cd-fade-up flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/cases"
          className="flex h-9 items-center gap-2 whitespace-nowrap rounded-[var(--rs)] border border-[var(--line-ctl)] bg-[var(--card)] px-3.5 text-[12.5px] font-semibold text-[var(--slate)] transition-[color,background-color,border-color,transform] active:scale-[0.97] hover:border-[var(--line-hover)] hover:text-[var(--accent)]"
        >
          ← Case library
        </Link>
        <CaseActions caseId={c.id} progress={progress} />
      </div>

      <div className="pb-0.5 pt-1.5 text-center">
        <p className="text-[12.5px] text-[var(--muted-2)]">
          {c.casebook?.name ?? "Unknown casebook"} · p. {c.source_start_page}
        </p>
        <h1 className="mx-auto mt-2 max-w-[900px] text-[clamp(30px,7vw,52px)] leading-[1.04] tracking-[-0.03em]">
          {titleLead}
          <span className="text-[var(--accent)]">{titleLast}</span>
        </h1>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-[7px]">
          {c.case_types.map((t, i) => (
            <Pill key={`type-${t}-${i}`} tone={i === 0 ? "accent" : "chip"}>
              {t}
            </Pill>
          ))}
          {c.industry && <Pill>{c.industry}</Pill>}
          {c.company && <Pill>{c.company}</Pill>}
          {c.difficulty && <Pill>{c.difficulty}</Pill>}
          <RatingPill avg={c.avg_rating} count={c.rating_count} />
          {c.tags_inferred && (
            <Pill className="text-[var(--muted-2)]">tags inferred</Pill>
          )}
          {c.extra_tags.map((t, i) => (
            <Pill key={`extra-${t}-${i}`} className="text-[var(--muted-2)]">
              {t}
            </Pill>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {promptText && (
          <section className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-[22px] [box-shadow:var(--sh)] max-desk:px-4">
            <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
              Prompt
            </p>
            <p className="whitespace-pre-line text-[16px] leading-[1.6] text-[var(--ink)] [text-wrap:pretty]">
              {promptText}
            </p>
          </section>
        )}

        {transcriptTurns.length > 0 && <Transcript turns={transcriptTurns} />}

        {c.exhibit_image_urls.length > 0 && (
          <section>
            <h2 className="mb-2.5 px-0.5 text-[19px] tracking-[-0.015em]">
              Exhibits
            </h2>
            <div className="flex flex-col gap-3.5">
              {c.exhibit_image_urls.map((path, i) => (
                <ImageCard
                  key={path}
                  signedUrl={signedByPath.get(path)}
                  alt={`Exhibit ${i + 1} — ${c.title}`}
                />
              ))}
            </div>
          </section>
        )}

        {c.solution_image_urls.length > 0 && (
          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
              <h2 className="text-[19px] tracking-[-0.015em]">Solution</h2>
              <span className="text-[12px] text-[var(--muted-2)]">
                From the casebook
              </span>
            </div>
            <div className="flex flex-col gap-3.5">
              {c.solution_image_urls.map((path, i) => (
                <ImageCard
                  key={path}
                  signedUrl={signedByPath.get(path)}
                  alt={`Solution page ${i + 1} — ${c.title}`}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
