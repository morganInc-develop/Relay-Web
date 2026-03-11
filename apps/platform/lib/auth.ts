import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import authConfig from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

const nextAuth = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      console.log("[auth] session callback — userId:", user.id);

      const subscription = await prisma.subscription.findUnique({
        where: { userId: user.id },
        select: { tier: true },
      });

      console.log("[auth] session subscription:", subscription);

      session.user.id = user.id;
      session.user.email = user.email;
      session.user.tier = subscription?.tier ?? null;

      return session;
    },
    async signIn({ user }) {
      console.log("[auth] signIn callback — userId:", user.id, "email:", user.email);
      return true;
    },
    async redirect({ url, baseUrl }) {
      console.log("[auth] redirect callback — url:", url, "baseUrl:", baseUrl);

      // Block cross-origin redirects
      const redirectUrl = url.startsWith("/") ? `${baseUrl}${url}` : url;
      try {
        const targetUrl = new URL(redirectUrl);
        const rootUrl = new URL(baseUrl);

        if (targetUrl.origin !== rootUrl.origin) {
          console.log("[auth] redirect: cross-origin blocked, returning baseUrl");
          return baseUrl;
        }

        // After OAuth the callback route itself isn't a useful landing page —
        // send the user to /dashboard and let the layout handle subscription routing.
        if (targetUrl.pathname.startsWith("/api/auth")) {
          console.log("[auth] redirect: auth API path, defaulting to /dashboard");
          return `${baseUrl}/dashboard`;
        }

        console.log("[auth] redirect: honoring callbackUrl", targetUrl.toString());
        return targetUrl.toString();
      } catch (error) {
        console.error("[auth] redirect callback failed", error);
        return baseUrl;
      }
    },
  },
  events: {
    async createUser({ user }) {
      console.info("[auth] created user", {
        userId: user.id,
        email: user.email,
      });
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;
