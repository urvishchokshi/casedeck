import { Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
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
    <div>
      <PageHeader
        title="Casebooks"
        subtitle="Prefer the raw PDFs? Every book in one place."
      />

      {casebooks.length === 0 ? (
        <Card className="grid place-items-center px-6 py-16 text-center">
          <div>
            <p className="text-[17px] font-semibold text-[var(--ink)]">
              No casebooks yet
            </p>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Books land here as they&apos;re imported.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {casebooks.map((cb) => {
            const count = caseCounts.get(cb.id) ?? 0;
            const signedUrl = cb.pdf_url ? signedByPath.get(cb.pdf_url) : undefined;
            return (
              <Card key={cb.id} className="flex flex-col gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-ui)] text-[19px] font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
                    {cb.name}
                  </h2>
                  {cb.college && (
                    <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                      {cb.college}
                    </p>
                  )}
                  <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                    {count > 0
                      ? `${count} case${count === 1 ? "" : "s"} on Casedeck`
                      : "Cases coming soon"}
                  </p>
                </div>
                {signedUrl ? (
                  <ButtonLink
                    variant="primary"
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start"
                  >
                    <Download size={16} />
                    Download PDF
                  </ButtonLink>
                ) : (
                  <Button variant="secondary" disabled className="self-start">
                    <Download size={16} />
                    {cb.pdf_url ? "PDF unavailable" : "PDF coming soon"}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
