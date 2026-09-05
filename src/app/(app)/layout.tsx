import { redirect } from "next/navigation";
import {
  AppShell,
  type ShellCounts,
  type ShellUser,
} from "@/components/AppShell";
import { isIsbEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase() || "?";
}

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already guards these routes; this is a belt-and-braces check
  // (it also covers any future dotted route paths the proxy matcher skips).
  if (!user || !user.email) {
    redirect("/login");
  }
  if (!isIsbEmail(user.email)) {
    redirect("/login?error=domain");
  }

  const metadataName = user.user_metadata?.full_name;
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : user.email.split("@")[0];

  const shellUser: ShellUser = {
    name,
    email: user.email,
    initials: initialsOf(name),
  };

  // Nav badge counts (head-only, immune to the PostgREST row cap).
  const [{ count: caseCount }, { count: casebookCount }] = await Promise.all([
    supabase.from("cases").select("*", { count: "exact", head: true }),
    supabase.from("casebooks").select("*", { count: "exact", head: true }),
  ]);

  const counts: ShellCounts = {
    cases: caseCount ?? 0,
    casebooks: casebookCount ?? 0,
  };

  return (
    <AppShell user={shellUser} counts={counts}>
      {children}
    </AppShell>
  );
}
