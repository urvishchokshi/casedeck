import { Download } from "lucide-react";
import { ImageCard } from "@/components/ImageCard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import type { Framework, Material } from "@/lib/types";

type FrameworkRow = Framework & { casebook: { name: string } | null };

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function FrameworksPage() {
  const supabase = await createClient();

  const [frameworksRes, materialsRes] = await Promise.all([
    supabase
      .from("frameworks")
      .select("*, casebook:casebooks(name)")
      .order("sort_order")
      .order("title"),
    supabase.from("materials").select("*").order("sort_order").order("title"),
  ]);
  const firstError = frameworksRes.error ?? materialsRes.error;
  if (firstError) {
    throw new Error(`Failed to load study material: ${firstError.message}`);
  }
  const frameworks = (frameworksRes.data ?? []) as unknown as FrameworkRow[];
  const materials = (materialsRes.data ?? []) as unknown as Material[];

  const header = (
    <PageHeader
      title="Frameworks & study material"
      subtitle="Reference structures and downloads to study between cases."
    />
  );

  if (frameworks.length === 0 && materials.length === 0) {
    return (
      <div>
        {header}
        <Card className="grid place-items-center px-6 py-16 text-center">
          <div>
            <p className="text-[17px] font-semibold text-[var(--ink)]">
              Material lands here soon
            </p>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Frameworks and downloads are on their way.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Framework images are the same objects the case importer renders into the
  // private case-images bucket; materials live in library-files. One batched
  // signing call per bucket, failures logged — ImageCard and the download
  // buttons degrade per-item.
  const imagePaths = frameworks.flatMap((f) => f.image_paths);
  const signedImageByPath = new Map<string, string>();
  if (imagePaths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from("case-images")
      .createSignedUrls(imagePaths, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(`Failed to sign framework image URLs: ${signError.message}`);
    }
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) {
        signedImageByPath.set(item.path, item.signedUrl);
      }
    }
  }

  const filePaths = materials.map((m) => m.file_path);
  const signedFileByPath = new Map<string, string>();
  if (filePaths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from("library-files")
      .createSignedUrls(filePaths, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(`Failed to sign material file URLs: ${signError.message}`);
    }
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) {
        signedFileByPath.set(item.path, item.signedUrl);
      }
    }
  }

  // Group by casebook id (names aren't unique-constrained), preserving arrival
  // order (already sorted by sort_order then title); ungrouped entries render
  // last under "General".
  const groups = new Map<string | null, FrameworkRow[]>();
  for (const f of frameworks) {
    const key = f.casebook_id;
    const group = groups.get(key);
    if (group) {
      group.push(f);
    } else {
      groups.set(key, [f]);
    }
  }
  const orderedGroups = [...groups.entries()].sort(
    (a, b) => Number(a[0] === null) - Number(b[0] === null)
  );

  return (
    <div className="mx-auto max-w-[820px]">
      {header}

      <div className="flex flex-col gap-9">
        {frameworks.length > 0 && (
          <section>
            <h2 className="mb-4 text-[24px] text-[var(--ink)]">Frameworks</h2>
            <div className="flex flex-col gap-8">
              {orderedGroups.map(([casebookId, group]) => (
                <div key={casebookId ?? "general"}>
                  <p className="mb-3.5 text-[11.5px] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">
                    {group[0].casebook ? `From ${group[0].casebook.name}` : "General"}
                  </p>
                  <div className="flex flex-col gap-[26px]">
                    {group.map((f) => (
                      <article key={f.id}>
                        <h3 className="text-[24px] text-[var(--ink)]">
                          {f.title}
                        </h3>
                        {f.description && (
                          <p className="mt-1 text-[14px] leading-[1.6] text-[var(--muted)]">
                            {f.description}
                          </p>
                        )}
                        {f.image_paths.length > 0 && (
                          <div className="mt-3.5 flex flex-col gap-3.5">
                            {f.image_paths.map((path, i) => (
                              <ImageCard
                                key={path}
                                signedUrl={signedImageByPath.get(path)}
                                alt={`${f.title} — page ${i + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {materials.length > 0 && (
          <section>
            <h2 className="mb-4 text-[24px] text-[var(--ink)]">
              Study material
            </h2>
            <Card className="divide-y divide-[var(--line-soft)] overflow-hidden p-0">
              {materials.map((m) => {
                const signedUrl = signedFileByPath.get(m.file_path);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-4 px-[18px] py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[15.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                        {m.title}
                      </p>
                      {m.description && (
                        <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
                          {m.description}
                        </p>
                      )}
                    </div>
                    {signedUrl ? (
                      <ButtonLink
                        variant="secondary"
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Download size={16} />
                        Download
                      </ButtonLink>
                    ) : (
                      <Button variant="secondary" disabled className="shrink-0">
                        Unavailable
                      </Button>
                    )}
                  </div>
                );
              })}
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
