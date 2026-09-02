import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isIsbEmail } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    const providerError = searchParams.get("error");
    if (providerError) {
      console.error(
        `OAuth provider error: ${providerError} — ${searchParams.get("error_description") ?? "no description"}`
      );
    }
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (!isIsbEmail(data.user.email)) {
    // Enforcement layer 1: delete the just-created auth user so no orphan
    // non-ISB accounts accumulate, then drop the session.
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
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  return NextResponse.redirect(`${origin}/cases`);
}
