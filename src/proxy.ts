import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { isIsbEmail } from "@/lib/auth";
import { requestOrigin } from "@/lib/site-url";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/health"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT against Supabase (unlike getSession) and
  // refreshes an expired session as a side effect. Fail closed if the auth
  // server is unreachable: treat the request as unauthenticated rather than
  // throwing a 500 on every route.
  let user: User | null = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (e) {
    console.error(
      `proxy getUser failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`
    );
  }

  const { pathname } = request.nextUrl;

  const redirectTo = (path: string, search = "") => {
    // Forwarded host first (behind Vercel's proxy request.url can carry the
    // internal localhost origin), else the request's own URL. Deliberately not
    // siteOrigin(): a redirect to a *configured* host could differ from the one
    // the browser is on, stranding the session cookies copied over below.
    const url = new URL(path, requestOrigin(request) ?? request.url);
    // Assigned rather than concatenated so both "?a=b" and "a=b" normalize.
    url.search = search;
    const redirect = NextResponse.redirect(url);
    // Carry over any refreshed/cleared session cookies.
    response.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Enforcement layer 2: a valid session with a non-ISB email is never
  // allowed through (the callback should already have deleted the user).
  if (user && !isIsbEmail(user.email)) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Still bounce them — a failed sign-out must not 500 the request.
      console.error(
        `proxy signOut failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`
      );
    }
    return redirectTo("/login", "?error=domain");
  }

  if (!user && !isPublicPath(pathname)) {
    return redirectTo("/login");
  }

  if (user && pathname === "/login") {
    return redirectTo("/cases");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets:
     * - _next/static, _next/image
     * - _vercel (analytics beacons — /_vercel/insights/view has no extension
     *   and must not be auth-redirected for signed-out visitors on /login)
     * - favicon.ico and any file with an extension (images, fonts, …)
     */
    "/((?!_next/static|_next/image|_vercel|favicon\\.ico|.*\\..*).*)",
  ],
};
