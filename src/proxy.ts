import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes accessible only while logged OUT
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

// Route prefix → required role
const PROTECTED_ROUTES: Record<string, string[]> = {
  "/admin": ["admin"],
  "/instructor": ["tutor", "admin"],
  "/dashboard": ["student", "tutor", "admin"],
};

export default auth((req: NextRequest & { auth: { user?: { role?: string; status?: string } } | null }) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const isLoggedIn = !!user;

  // ── Auth-only routes ─────────────────────────────────────────────────────────
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // ── Protected routes ─────────────────────────────────────────────────────────
  const matchedPrefix = Object.keys(PROTECTED_ROUTES).find((prefix) =>
    pathname.startsWith(prefix)
  );

  if (matchedPrefix) {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Suspended users → blocked
    if (user?.status === "suspended") {
      return NextResponse.redirect(new URL("/suspended", req.url));
    }

    // Pending tutors can only access limited routes
    if (user?.status === "pending" && pathname.startsWith("/instructor")) {
      return NextResponse.redirect(new URL("/pending-approval", req.url));
    }

    // Role check
    const allowedRoles = PROTECTED_ROUTES[matchedPrefix];
    if (user?.role && !allowedRoles.includes(user.role)) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|opengraph-image|site.webmanifest|\.well-known|public|images).*)",
  ],
};
