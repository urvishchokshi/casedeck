import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Sign in — Casedeck",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-screen bg-[var(--canvas)] lg:grid-cols-[1.1fr_0.9fr]">
      <div className="flex flex-col justify-between gap-12 px-8 py-10 lg:px-[68px] lg:py-14">
        <Brand />
        <div className="max-w-[600px]">
          <h1 className="text-[52px] leading-[0.94] lg:text-[76px]">
            Every casebook,
            <br />
            <span className="italic text-[var(--accent)]">one shelf.</span>
          </h1>
          <p className="mt-5 max-w-[460px] text-[17px] text-[var(--muted)]">
            Case prep for ISB placements
          </p>
        </div>
        <p className="text-[12px] text-[var(--muted)]">Hyderabad &amp; Mohali</p>
      </div>

      <div className="grid place-items-center p-8 lg:p-12 [background:var(--login-panel)]">
        <div className="flex w-full max-w-[372px] flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-[30px] [box-shadow:var(--sh)]">
          <div>
            <h2 className="text-[28px]">Sign in</h2>
            <p className="mt-1.5 text-[13.5px] text-[var(--muted)]">
              Use your @isb.edu account. Your cases and stats sync across
              devices.
            </p>
          </div>
          <Button disabled className="h-11 w-full text-[14.5px]">
            Sign in with Microsoft
          </Button>
        </div>
      </div>
    </div>
  );
}
