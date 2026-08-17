import { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "student" | "tutor" | "admin";
      status: "active" | "pending" | "suspended" | "invited";
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    status?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    status: string;
  }
}
