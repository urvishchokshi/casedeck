import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isIsbEmail } from "@/lib/auth";
import { siteOrigin } from "@/lib/site-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Resolved from x-forwarded-host first: behind Vercel's proxy the origin of
  // `request.url` can be the internal http://localhost:3000.
  const origin = siteOrigin(request);
  const fail = () => NextResponse.redirect(`${origin}/login?error=auth`);

  try {
    const code = searchParams.get("code");

    if (!code) {
      const providerError = searchParams.get("error");
      if (providerError) {
        // error_description is attacker-controllable query input — truncate it.
        console.error(
          `OAuth provider error: ${providerError} — ${searchParams.get("error_description")?.slice(0, 200) ?? "no description"}`
        );
      }
      return fail();
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return fail();
    }

    if (!isIsbEmail(data.user.email)) {
      // Enforcement layer 1: delete the just-created auth user so no orphan
      // non-ISB accounts accumulate, then drop the session.
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const admin = createAdminClient();
        const { error: deleteError } = await admin.auth.admin.deleteUser(
          data.user.id
        );
        if (deleteError) {
          // The proxy still blocks this user everywhere; log so the orphaned
          // auth row can be cleaned up manually.
          console.error(
            `Failed to delete non-ISB auth user ${data.user.id}: ${deleteError.message}`
          );
        }
      } else {
        // Degrade instead of 500ing — but this is an enforcement gap, not
        // just lost cleanup: the proxy only guards the Next app, and an
        // undeleted auth user can hit the Supabase API directly with the
        // anon key (RLS grants `authenticated` read on shared content and
        // match_profiles). Set the key in production.
        console.error(
          `SUPABASE_SERVICE_ROLE_KEY not set — skipping deletion of non-ISB auth user ${data.user.id}`
        );
      }
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=domain`);
    }

    return NextResponse.redirect(`${origin}/cases`);
  } catch (e) {
    console.error(
      `Auth callback failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`
    );
    return fail();
  }
}
