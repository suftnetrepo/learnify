import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validations/auth";
import { log } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { clearRateLimit, rateLimit } from "@/lib/rate-limit";
import { getAuthState, invalidateAuthState } from "./status-cache";

/** Surfaced to the login form as `result.code === "suspended"`. */
class AccountSuspendedError extends CredentialsSignin {
  code = "suspended";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Render (and most non-Vercel hosts) don't set any of the env vars
  // (AUTH_URL / AUTH_TRUST_HOST / VERCEL / CF_PAGES) that Auth.js checks to
  // auto-trust the request Host header, so every request gets rejected with
  // UntrustedHost unless this is set explicitly.
  // https://errors.authjs.dev#untrustedhost
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  events: {
    async signIn({ user }) {
      Sentry.setUser({ id: user.id ?? undefined, email: user.email ?? undefined });
    },
    async signOut() {
      Sentry.setUser(null);
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: attach DB fields to the token
        token.id = user.id as string;
        token.role = user.role as string;
        token.status = user.status as string;
        return token;
      }

      // Every later request: re-read status/role so suspensions, deletions and
      // role changes take effect immediately instead of when the JWT expires.
      // Returning null clears the session cookie, signing the user out everywhere
      // (pages, proxy and API routes) regardless of role.
      if (!token.id) return null;
      try {
        const current = await getAuthState(token.id as string);
        if (current.revoked) {
          log.info("Revoking session", { userId: token.id });
          return null;
        }

        token.role = current.role;
        token.status = current.status;
      } catch (error) {
        // Fail open on transient DB errors — throwing here would sign every user out.
        log.error("Session status refresh failed", { error, userId: token.id });
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "student" | "tutor" | "admin";
        session.user.status = token.status as "active" | "pending" | "suspended" | "invited";
      }
      return session;
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAuth = nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");

      if (isOnAuth) return !isLoggedIn ? true : Response.redirect(new URL("/dashboard", nextUrl));
      if (!isLoggedIn) return false;
      return true;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Rate limit per email: 10 attempts per 15 minutes
        // This prevents brute-force attacks on known accounts
        const limiter = rateLimit("login:email", email.toLowerCase(), { limit: 10, windowMs: 15 * 60 * 1000 });
        if (!limiter.success) {
          log.warn("Login rate limit exceeded", { email });
          return null; // NextAuth will surface an error to the user
        }

        let user;
        try {
          [user] = await db
            .select()
            .from(users)
            .where(and(eq(users.email, email), isNull(users.deletedAt)))
            .limit(1);

          if (!user || !user.passwordHash) return null;

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) return null;
        } catch (error) {
          log.error("Auth error", { error });
          return null;
        }

        // Checked only after the password matches so the suspended state
        // isn't disclosed to someone guessing credentials.
        if (user.status === "suspended") {
          log.warn("Suspended user attempted sign-in", { userId: user.id });
          throw new AccountSuspendedError();
        }

        // A valid login starts a fresh limiter window. Without this, even
        // successful sign-ins count toward the ten-attempt lockout.
        clearRateLimit("login:email", email.toLowerCase());

        // We just read fresh state — drop any stale cached "revoked" entry so a
        // reactivated user isn't bounced by the cache right after signing in.
        invalidateAuthState(user.id);

        try {
          // Update last login
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user.id));

          log.info("User signed in", { userId: user.id, email: user.email });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatarUrl,
            role: user.role as string,
            status: user.status as string,
          };
        } catch (error) {
          log.error("Auth error", { error });
          return null;
        }
      },
    }),
  ],
});
