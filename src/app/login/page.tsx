import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Sign in — CasePrep",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8 text-center">
        <h1 className="text-[length:var(--font-size-2xl)] font-bold tracking-tight text-[var(--color-accent)]">
          CasePrep
        </h1>
        <p className="mt-2 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
          Case prep for ISB placements
        </p>
        <Button disabled className="mt-8 w-full">
          Sign in with Microsoft
        </Button>
        <p className="mt-4 text-[length:var(--font-size-xs)] text-[var(--color-text-muted)]">
          Sign in with your @isb.edu account
        </p>
      </Card>
    </div>
  );
}
