import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isIsbEmail } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

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
  // refreshes an expired session as a side effect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirectTo = (path: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = path;
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
    await supabase.auth.signOut();
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
     * - favicon.ico and any file with an extension (images, fonts, …)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)",
  ],
};
