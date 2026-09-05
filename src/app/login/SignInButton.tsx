"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function SignInButton() {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email openid profile",
        // Deliberately the *current* browser origin, not NEXT_PUBLIC_SITE_URL:
        // the PKCE code verifier is stored by the browser client on this
        // origin, so coming back to any other host breaks the code exchange.
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // On success the browser navigates away; only reset on failure.
    if (error) setLoading(false);
  };

  return (
    <Button
      onClick={signIn}
      disabled={loading}
      className="h-11 w-full text-[14.5px]"
    >
      {loading ? "Redirecting…" : "Sign in with Microsoft"}
    </Button>
  );
}
