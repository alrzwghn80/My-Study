import type { NextAuthConfig } from "next-auth";

// Edge-safe base config: no providers (Credentials' authorize() touches
// Prisma, which isn't Edge-compatible) — used by middleware for a fast,
// stateless "is there a valid session" check. The full config with the
// Credentials provider lives in auth.ts, used everywhere else (Node runtime).
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Self-hosted (VPS) deployment, not Vercel — Auth.js can't otherwise
  // verify the incoming Host header is trustworthy. Set explicitly here
  // (rather than relying solely on the AUTH_TRUST_HOST env var, which is
  // also supported but is one more thing to remember to set correctly in
  // every environment) since single-user self-hosting is this app's only
  // deployment target — see docs/architecture.md.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.userId && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
