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
