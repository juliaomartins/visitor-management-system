import { NextResponse, type NextRequest } from "next/server";

/**
 * Route guard.
 *
 * Named `proxy.ts` rather than `middleware.ts`: Next 16 renamed the convention,
 * and the old filename still works but warns on every build.
 *
 * This is navigation, not security. It reads `vms_session`, a cookie that holds
 * no token and proves nothing — it exists so an unauthenticated visitor lands on
 * the sign-in page instead of watching an empty table fail to load. The actual
 * boundary is the backend, which rejects any request without a valid bearer token
 * regardless of what this file decides.
 *
 * It cannot read the refresh cookie: that one is httpOnly and path-scoped to
 * `/api/v1/auth`, so the browser does not send it on a navigation to `/visitors`.
 */
const SESSION_HINT = "vms_session";
const HOME = "/dashboard";
const SIGN_IN = "/login";

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = request.cookies.has(SESSION_HINT);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(signedIn ? HOME : SIGN_IN, request.url));
  }

  if (pathname === SIGN_IN) {
    return signedIn
      ? NextResponse.redirect(new URL(HOME, request.url))
      : NextResponse.next();
  }

  if (!signedIn) {
    const target = new URL(SIGN_IN, request.url);
    // Come back to where they were aiming once they are through.
    target.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except the proxied backend routes, Next internals and static files.
    "/((?!api/|media/|_next/|favicon.ico|.*\\.svg$).*)",
  ],
};
