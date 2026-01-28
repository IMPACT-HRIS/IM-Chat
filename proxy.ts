import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("staging.im.sso.sid");
  const isLoginPage = request.nextUrl.pathname === "/login";

  // If user has no session and is not on login page, redirect to login
  if (!sessionCookie && !isLoginPage) {
    // Allow static files and API routes to pass through if needed,
    // strictly redirecting page navigations.
    // For now, protecting everything except /login and static assets is a good default.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If user has session and is on login page, redirect to home
  if (sessionCookie && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
