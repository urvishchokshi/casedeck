import { Download } from "lucide-react";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { createClient } from "@/lib/supabase/server";
import type { Casebook } from "@/lib/types";

export const metadata = { title: "Casebooks" };

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function CasebooksPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("casebooks")
    .select("*")
    .order("name");
  if (error) {
    throw new Error(`Failed to load casebooks: ${error.message}`);
  }
  const casebooks = (data ?? []) as unknown as Casebook[];

  // Exact head counts per book: no row transfer, immune to the PostgREST
  // 1000-row default cap, and the book list stays a handful of rows.
  const countResults = await Promise.all(
    casebooks.map((cb) =>
      supabase
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("casebook_id", cb.id)
    )
  );
  const caseCounts = new Map<string, number>();
  casebooks.forEach((cb, i) => {
    const { count, error: countError } = countResults[i];
    if (countError) {
      console.error(`Failed to count cases for casebook ${cb.slug}: ${countError.message}`);
    }
    caseCounts.set(cb.id, count ?? 0);
  });

  // pdf_url holds a storage path in the private library-files bucket.
  const pdfPaths = casebooks
    .map((cb) => cb.pdf_url)
    .filter((p): p is string => p !== null);
  const signedByPath = new Map<string, string>();
  if (pdfPaths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from("library-files")
      .createSignedUrls(pdfPaths, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(`Failed to sign casebook PDF URLs: ${signError.message}`);
    }
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) {
        signedByPath.set(item.path, item.signedUrl);
      }
    }
  }

  return (
    <>
      <PageTitle plain="Case" accent="books" />

      <div className="flex flex-col rounded-[20px] border border-[var(--tint-border)] bg-[var(--tint)] p-1.5">
        <div className="flex flex-col items-center gap-3 px-4 pb-3.5 pt-4">
          <span className="text-[22px] font-bold tracking-[-0.02em] text-[var(--heading)]">
            {casebooks.length}{" "}
            <span className="text-[var(--accent)]">
              casebook{casebooks.length === 1 ? "" : "s"}
            </span>
          </span>
        </div>

        {casebooks.length === 0 ? (
          <div className="grid place-items-center rounded-[var(--r)] bg-[var(--card)] px-6 py-16 text-center [box-shadow:var(--sh)]">
            <div>
              <p className="text-[17px] font-semibold text-[var(--ink)]">
                No casebooks yet
              </p>
              <p className="mt-1 text-[14px] text-[var(--muted)]">
                Books land here as they&apos;re imported.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-4 px-3 pb-4 max-desk:grid-cols-1">
            {casebooks.map((cb) => {
              const count = caseCounts.get(cb.id) ?? 0;
              const signedUrl = cb.pdf_url ? signedByPath.get(cb.pdf_url) : undefined;
              return (
                <div
                  key={cb.id}
                  className="flex flex-col gap-[18px] rounded-[var(--r)] border border-[var(--line-card)] bg-[var(--card)] p-[22px] transition-[border-color,box-shadow] [box-shadow:var(--sh)] hover:border-[var(--line-card-hover)] hover:[box-shadow:var(--sh-card-hover)]"
                >
                  <div className="min-w-0">
                    <h2 className="text-[19px] leading-[1.2] tracking-[-0.015em]">
                      {cb.college ?? cb.name}
                    </h2>
                    <p className="mt-[5px] text-[13px] text-[var(--muted-2)]">
                      {cb.name}
                    </p>
                  </div>

                  <div className="flex items-baseline justify-between gap-2.5 border-t border-[var(--line-inner)] pt-3.5">
                    <span className="text-[13px] text-[var(--muted)]">
                      Cases on CaseDeck
                    </span>
                    <span className="text-[22px] font-bold tracking-[-0.02em] text-[var(--accent)]">
                      {count}
                    </span>
                  </div>

                  <div className="mt-auto">
                    {signedUrl ? (
                      <ButtonLink
                        variant="primary"
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-[42px] w-full rounded-[11px]"
                      >
                        <Download size={15} />
                        Download PDF
                      </ButtonLink>
                    ) : (
                      <Button
                        variant="secondary"
                        disabled
                        className="h-[42px] w-full rounded-[11px]"
                      >
                        <Download size={15} />
                        {cb.pdf_url ? "PDF unavailable" : "PDF coming soon"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
