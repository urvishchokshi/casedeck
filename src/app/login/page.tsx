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

// The landing fan: real app screenshots (public/landing/, exported from the
// design project) tilted around the center card.
const fanCards = [
  {
    src: "/landing/dashboard.png",
    alt: "CaseDeck dashboard",
    width: 1600,
    height: 1023,
    className:
      "cd-fan-left absolute left-[-3%] top-[clamp(28px,5vw,78px)] w-1/2 rounded-[var(--r)] border border-[var(--landing-card-line)] [box-shadow:var(--sh-landing-card)]",
  },
  {
    src: "/landing/partner.png",
    alt: "Find a Partner directory",
    width: 1600,
    height: 1037,
    className:
      "cd-fan-right absolute right-[-3%] top-[clamp(28px,5vw,78px)] w-1/2 rounded-[var(--r)] border border-[var(--landing-card-line)] [box-shadow:var(--sh-landing-card)]",
  },
  {
    src: "/landing/library.png",
    alt: "Case Library",
    width: 1600,
    height: 964,
    className:
      "cd-fan-center relative mx-auto w-3/5 rounded-[var(--r-hero)] border border-[var(--landing-card-line-strong)] [box-shadow:var(--sh-landing-card-lg)]",
  },
];

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
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--landing-bg)] text-[var(--landing-ink)]">
      {/* Decorative layers — top halo, faint grid, drifting glow, bottom fade.
          The #000 inside mask-image is alpha-only (masks ignore hue) — not a
          color-token violation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:var(--landing-halo)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--landing-grid) 1px, transparent 1px), linear-gradient(90deg, var(--landing-grid) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(120% 78% at 50% 8%, #000 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(120% 78% at 50% 8%, #000 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="cd-drift pointer-events-none absolute left-1/2 top-[clamp(300px,44vw,540px)] ml-[-590px] h-[620px] w-[1180px] rounded-full blur-[40px] [background:var(--landing-glow)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:var(--landing-fade)]"
      />

      <header className="relative flex items-center justify-center px-[clamp(16px,4vw,40px)] pb-2 pt-[clamp(20px,5vw,34px)]">
        <Brand
          onDark
          markWidth={52}
          wordmarkClassName="text-[clamp(20px,5vw,28px)] font-bold tracking-[-0.025em]"
        />
      </header>

      <main className="cd-fade-up relative flex flex-1 flex-col items-center justify-center px-[clamp(16px,5vw,32px)] pb-[clamp(60px,12vw,110px)] pt-[clamp(24px,6vw,40px)] text-center">
        {/* Inline color: the unlayered global h1 rule beats layered Tailwind
            utilities, so a text-[…] class can't override it here. */}
        <h1
          style={{ color: "var(--landing-ink)" }}
          className="max-w-[1080px] text-[clamp(34px,8.5vw,82px)] font-extrabold leading-[1.04] tracking-[-0.04em] [text-wrap:balance]"
        >
          Every casebook,
          <br />
          one <span className="text-[var(--landing-accent)]">
            searchable
          </span>{" "}
          library.
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

      <section className="relative px-[clamp(16px,4vw,40px)] pb-[clamp(56px,10vw,120px)]">
        <div className="relative mx-auto w-full max-w-[1240px]">
          {fanCards.map(({ src, alt, width, height, className }) => (
            <div
              key={src}
              className={`overflow-hidden bg-[var(--card)] ${className}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static hero screenshots; intrinsic width/height reserve space (no CLS) */}
              <img
                src={src}
                alt={alt}
                width={width}
                height={height}
                className="block h-auto w-full"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
