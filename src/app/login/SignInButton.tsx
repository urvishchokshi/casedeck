"use client";

import { useState } from "react";
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
    <button
      type="button"
      onClick={signIn}
      disabled={loading}
      className="mt-[38px] flex h-14 items-center gap-[11px] whitespace-nowrap rounded-[14px] bg-[var(--accent)] px-[30px] text-[15px] font-semibold text-[var(--on-accent)] transition-colors [box-shadow:var(--sh-cta)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M10 2.5l6.5 3.2v4.6c0 3.4-2.6 6.2-6.5 7.2-3.9-1-6.5-3.8-6.5-7.2V5.7L10 2.5z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M7.4 10.1l1.9 1.9 3.4-3.7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {loading ? "Redirecting…" : "Sign in with ISB ID"}
    </button>
  );
}
