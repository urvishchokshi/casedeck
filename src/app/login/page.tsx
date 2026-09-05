import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { SignInButton } from "./SignInButton";

export const metadata: Metadata = {
  title: "Sign in",
};

const errorMessages: Record<string, string> = {
  domain: "Please sign in with your @isb.edu account.",
  auth: "Something went wrong while signing you in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error
    ? Object.hasOwn(errorMessages, error)
      ? errorMessages[error]
      : errorMessages.auth
    : null;

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden text-[var(--heading)] [background:var(--landing-bg)]"
    >
      {/* Decorative layers — faint grid, concentric circles, drifting glow.
          The #000 inside mask-image is alpha-only (masks ignore hue) — not a
          color-token violation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--landing-grid) 1px, transparent 1px), linear-gradient(90deg, var(--landing-grid) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(115% 80% at 50% 26%, #000 0%, transparent 76%)",
          WebkitMaskImage:
            "radial-gradient(115% 80% at 50% 26%, #000 0%, transparent 76%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-620px] left-1/2 ml-[-750px] h-[1500px] w-[1500px] rounded-full border border-[var(--landing-ring-1)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-780px] left-1/2 ml-[-960px] h-[1920px] w-[1920px] rounded-full border border-[var(--landing-ring-2)]"
      />
      <div
        aria-hidden
        className="cd-drift pointer-events-none absolute bottom-[-340px] left-1/2 ml-[-580px] h-[720px] w-[1160px] rounded-full blur-[28px] [background:var(--landing-glow)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-170px] top-[-190px] h-[640px] w-[640px] rounded-full blur-[22px] [background:var(--landing-corner)]"
      />

      <header className="relative flex items-center justify-center px-[clamp(16px,4vw,40px)] pb-2 pt-[clamp(20px,5vw,34px)]">
        <Brand
          markWidth={52}
          wordmarkClassName="text-[clamp(20px,5vw,28px)] font-bold tracking-[-0.025em]"
        />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-[clamp(16px,5vw,32px)] pb-[clamp(60px,12vw,110px)] pt-[clamp(24px,6vw,40px)] text-center">
        <h1 className="max-w-[1080px] text-[clamp(34px,8.5vw,82px)] font-extrabold leading-[1.04] tracking-[-0.04em] [text-wrap:balance]">
          Every casebook,
          <br />
          one <span className="text-[var(--accent)]">searchable</span> library.
        </h1>

        {errorMessage && (
          <p
            role="alert"
            className="mt-8 rounded-[var(--rs)] bg-[var(--revisit-bg)] px-4 py-2.5 text-[13px] font-semibold text-[var(--revisit-fg)]"
          >
            {errorMessage}
          </p>
        )}

        <SignInButton />
      </main>
    </div>
  );
}
