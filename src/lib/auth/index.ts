import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validations/auth";
import { log } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { rateLimit } from "@/lib/rate-limit";

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

        try {
          const [user] = await db
            .select()
            .from(users)
            .where(and(eq(users.email, email), isNull(users.deletedAt)))
            .limit(1);

          if (!user || !user.passwordHash) return null;
          if (user.status === "suspended") return null;

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) return null;

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
