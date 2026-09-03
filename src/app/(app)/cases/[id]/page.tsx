import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import { RatingPill } from "@/components/RatingPill";
import { createClient } from "@/lib/supabase/server";
import type { Case } from "@/lib/types";
import { Transcript } from "./Transcript";
import { CaseActions, type CaseProgressState } from "./CaseActions";

type CaseDetailRow = Case & { casebook: { name: string } | null };

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function ImageCard({
  signedUrl,
  alt,
}: {
  signedUrl: string | undefined;
  alt: string;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] [box-shadow:var(--sh)]">
      {signedUrl ? (
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          {/* Full-page 2x renders from the private bucket; plain img keeps them unresized and sharp. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signedUrl} alt={alt} className="block h-auto w-full" />
        </a>
      ) : (
        <div className="grid h-48 place-items-center [background:var(--ph)]">
          <span className="text-[12px] font-semibold text-[var(--muted)]">
            Image unavailable
          </span>
        </div>
      )}
    </div>
  );
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
      .select("completed, marked_for_later, self_score, quality_rating")
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

  return (
    <div className="mx-auto max-w-[820px]">
      <Link
        href="/cases"
        className="mb-4 inline-block text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
      >
        ← Case library
      </Link>

      <div className="mb-[22px] flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="mb-2 font-[family-name:var(--font-mono)] text-[12px] font-medium text-[var(--muted)]">
            {c.casebook?.name ?? "Unknown casebook"} · p. {c.source_start_page}
          </p>
          <h1 className="mb-3 text-[44px] text-[var(--ink)]">{c.title}</h1>
          <div className="flex flex-wrap gap-[7px]">
            {c.case_types.map((t, i) => (
              <Pill key={`type-${t}-${i}`} tone="accent">
                {t}
              </Pill>
            ))}
            {c.industry && <Pill>{c.industry}</Pill>}
            {c.company && <Pill>{c.company}</Pill>}
            {c.difficulty && <Pill>{c.difficulty}</Pill>}
            <RatingPill avg={c.avg_rating} count={c.rating_count} />
            {c.tags_inferred && (
              <Pill className="text-[var(--muted)]">tags inferred</Pill>
            )}
            {c.extra_tags.map((t, i) => (
              <Pill key={`extra-${t}-${i}`} className="text-[var(--muted)]">
                {t}
              </Pill>
            ))}
          </div>
        </div>
        <CaseActions caseId={c.id} progress={progress} />
      </div>

      <div className="flex flex-col gap-[22px]">
        {promptText && (
          <section className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-[22px] [box-shadow:var(--sh)]">
            <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.07em] text-[var(--accent)]">
              Prompt
            </p>
            <p className="whitespace-pre-line text-[17px] leading-[1.6]">
              {promptText}
            </p>
          </section>
        )}

        {transcriptTurns.length > 0 && <Transcript turns={transcriptTurns} />}

        {c.exhibit_image_urls.length > 0 && (
          <section>
            <h2 className="mb-2.5 text-[24px] text-[var(--ink)]">Exhibits</h2>
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
            <h2 className="mb-2.5 text-[24px] text-[var(--ink)]">Solution</h2>
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
