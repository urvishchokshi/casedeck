import { isIsbEmail } from "@/lib/auth";
import { buildLiveInterviewerPrompt } from "@/lib/practice-live/prompt";
import type {
  PracticeSessionError,
  PracticeSessionResponse,
} from "@/lib/practice-live/protocol";
import {
  allowSessionRequest,
  createLiveToken,
  getCasebookNotes,
  getGeminiConfig,
} from "@/lib/practice-live/server";
import { splitProblemStatement } from "@/lib/practice-prompt";
import { createClient } from "@/lib/supabase/server";
import type { Case } from "@/lib/types";

// First request per case transcribes the slide images (~10–30s); later ones
// hit the cache and only mint a token.
export const maxDuration = 60;

type SessionCaseRow = Pick<
  Case,
  | "id"
  | "title"
  | "case_types"
  | "industry"
  | "difficulty"
  | "company"
  | "prompt"
  | "transcript"
  | "exhibit_image_urls"
  | "solution_image_urls"
> & { casebook: { name: string } | null };

const SIGNED_URL_TTL_SECONDS = 10 * 60;
const MAX_RESUME_HANDLE_LENGTH = 4096;

function fail(status: number, error: string) {
  return Response.json({ error } satisfies PracticeSessionError, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * POST { caseId, resumeHandle? } → { token, model }. Starts (or resumes) an
 * in-app voice practice session for /cases/[id]: builds the interviewer's
 * system instruction server-side — case block + transcript + casebook notes
 * — and locks it into a single-use Gemini Live token. Authenticated by the
 * session cookie (the proxy already redirects anonymous requests; checked
 * again here), case read under RLS like the page itself.
 */
export async function POST(request: Request) {
  const config = getGeminiConfig();
  if (!config) {
    return fail(
      503,
      "AI practice isn't set up yet: the Gemini API key is missing on the server."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const { caseId, resumeHandle } = (body ?? {}) as Record<string, unknown>;
  if (typeof caseId !== "string" || caseId.length === 0 || caseId.length > 64) {
    return fail(400, "Bad request.");
  }
  if (
    resumeHandle !== undefined &&
    (typeof resumeHandle !== "string" ||
      resumeHandle.length === 0 ||
      resumeHandle.length > MAX_RESUME_HANDLE_LENGTH)
  ) {
    return fail(400, "Bad request.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isIsbEmail(user.email)) {
    return fail(401, "Your session has expired. Refresh the page to sign in again.");
  }
  if (!allowSessionRequest(user.id)) {
    return fail(429, "Too many practice sessions in a short time. Wait a few minutes and try again.");
  }
  const resuming = typeof resumeHandle === "string";

  const { data, error } = await supabase
    .from("cases")
    .select(
      "id, title, case_types, industry, difficulty, company, prompt, transcript, exhibit_image_urls, solution_image_urls, casebook:casebooks(name)"
    )
    .eq("id", caseId)
    .maybeSingle();
  if (error) {
    // 22P02 = not a uuid.
    if (error.code === "22P02") return fail(404, "Case not found.");
    console.error(`practice session: case load failed: ${error.message}`);
    return fail(500, "Couldn't load this case. Try again.");
  }
  if (!data) return fail(404, "Case not found.");
  const c = data as unknown as SessionCaseRow;

  try {
    // Signed with the user's own client (bucket RLS = authenticated read) and
    // only fetched when the notes aren't cached yet. A resume never
    // transcribes (it must not stall a live call), so it skips signing.
    const paths = [
      ...new Set([...c.exhibit_image_urls, ...c.solution_image_urls]),
    ];
    const signedUrls = new Map<string, string>();
    if (paths.length > 0 && !resuming) {
      const { data: signed, error: signError } = await supabase.storage
        .from("case-images")
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (signError) {
        console.error(`practice session: signing failed: ${signError.message}`);
      }
      for (const item of signed ?? []) {
        if (item.path && item.signedUrl) signedUrls.set(item.path, item.signedUrl);
      }
    }

    const notes = await getCasebookNotes(
      {
        caseId: c.id,
        title: c.title,
        problemStatement: splitProblemStatement(c.prompt, c.transcript)
          .problemStatement,
        exhibitPaths: c.exhibit_image_urls,
        solutionPaths: c.solution_image_urls,
        signedUrls,
      },
      config,
      { mayTranscribe: !resuming }
    );

    const systemInstruction = buildLiveInterviewerPrompt(
      { ...c, casebookName: c.casebook?.name ?? "Unknown casebook" },
      notes
    );
    const { token, apiVersion } = await createLiveToken(
      config,
      systemInstruction,
      resuming ? resumeHandle : null
    );

    return Response.json(
      {
        token,
        model: config.liveModel,
        apiVersion,
      } satisfies PracticeSessionResponse,
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error(
      `practice session for case ${c.id} failed: ${
        e instanceof Error
          ? e.message.slice(0, 400)
          : "unknown error"
      }`
    );
    return fail(502, "Couldn't reach the AI interviewer. Try again in a moment.");
  }
}
