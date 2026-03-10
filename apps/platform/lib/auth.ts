import { PrismaAdapter } from "@auth/prisma-adapter";
import { SubscriptionStatus } from "@prisma/client";
import NextAuth, { type Session } from "next-auth";

import authConfig from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

let getSession: (() => Promise<Session | null>) | null = null;

const nextAuth = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: user.id },
        select: { tier: true },
      });

      session.user.id = user.id;
      session.user.email = user.email;
      session.user.tier = subscription?.tier ?? null;

      return session;
    },
    async signIn() {
      return true;
    },
    async redirect({ url, baseUrl }) {
      const redirectUrl = url.startsWith("/") ? `${baseUrl}${url}` : url;

      try {
        const targetUrl = new URL(redirectUrl);
        const rootUrl = new URL(baseUrl);

        if (targetUrl.origin !== rootUrl.origin) {
          return baseUrl;
        }

        if (targetUrl.pathname.startsWith("/api/auth")) {
          return targetUrl.toString();
        }

        const session = getSession ? await getSession() : null;

        if (!session?.user?.id) {
          return targetUrl.toString();
        }

        const subscription = await prisma.subscription.findUnique({
          where: { userId: session.user.id },
          select: { status: true },
        });

        if (subscription?.status === SubscriptionStatus.ACTIVE) {
          return `${baseUrl}/dashboard`;
        }

        return `${baseUrl}/onboarding`;
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

getSession = auth;
