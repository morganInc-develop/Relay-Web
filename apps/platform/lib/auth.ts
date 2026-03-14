import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import authConfig from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

// --- Startup diagnostics — visible in Vercel function logs ---
console.log("[auth:init] NextAuth initializing");
console.log("[auth:init] AUTH_SECRET present:", !!process.env.AUTH_SECRET);
console.log("[auth:init] NEXTAUTH_SECRET present:", !!process.env.NEXTAUTH_SECRET);
console.log("[auth:init] AUTH_URL:", process.env.AUTH_URL ?? "(not set)");
console.log("[auth:init] NEXTAUTH_URL:", process.env.NEXTAUTH_URL ?? "(not set)");
console.log("[auth:init] GOOGLE_CLIENT_ID present:", !!process.env.GOOGLE_CLIENT_ID);
console.log("[auth:init] GOOGLE_CLIENT_SECRET present:", !!process.env.GOOGLE_CLIENT_SECRET);
console.log("[auth:init] DATABASE_URL present:", !!process.env.DATABASE_URL);
console.log("[auth:init] DATABASE_URL has pooler:", process.env.DATABASE_URL?.includes("-pooler") ?? false);

// Test Prisma can reach the database before handing it to the adapter
prisma.$connect()
  .then(() => console.log("[auth:init] Prisma connected to database successfully"))
  .catch((err: unknown) => console.error("[auth:init] Prisma failed to connect:", err));

const nextAuth = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  logger: {
    error(error) {
      console.error("[auth:error]", error.name, (error as Error).message ?? error);
    },
    warn(code) {
      console.warn("[auth:warn]", code);
    },
    debug(message, metadata) {
      console.log("[auth:debug]", message, metadata ?? "");
    },
  },
  callbacks: {
    async session({ session, user }) {
      console.log("[auth:session] userId:", user.id);

      try {
        const subscription = await prisma.subscription.findUnique({
          where: { userId: user.id },
          select: { tier: true },
        });
        console.log("[auth:session] subscription:", subscription);
        session.user.id = user.id;
        session.user.email = user.email;
        session.user.tier = subscription?.tier ?? null;
      } catch (err) {
        console.error("[auth:session] prisma query failed:", err);
      }

      return session;
    },
    async signIn({ user, account }) {
      console.log("[auth:signIn] userId:", user.id, "email:", user.email, "provider:", account?.provider);
      return true;
    },
    async redirect({ url, baseUrl }) {
      console.log("[auth:redirect] url:", url, "baseUrl:", baseUrl);

      const redirectUrl = url.startsWith("/") ? `${baseUrl}${url}` : url;
      try {
        const targetUrl = new URL(redirectUrl);
        const rootUrl = new URL(baseUrl);

        if (targetUrl.origin !== rootUrl.origin) {
          console.log("[auth:redirect] cross-origin blocked, returning baseUrl");
          return baseUrl;
        }

        if (targetUrl.pathname.startsWith("/api/auth")) {
          console.log("[auth:redirect] auth API path, defaulting to /dashboard");
          return `${baseUrl}/dashboard`;
        }

        console.log("[auth:redirect] honoring callbackUrl:", targetUrl.toString());
        return targetUrl.toString();
      } catch (error) {
        console.error("[auth:redirect] failed:", error);
        return baseUrl;
      }
    },
  },
  events: {
    async createUser({ user }) {
      console.log("[auth:event] createUser — userId:", user.id, "email:", user.email);
    },
    async signIn({ user, account, isNewUser }) {
      console.log("[auth:event] signIn — userId:", user.id, "provider:", account?.provider, "isNewUser:", isNewUser);
    },
    async session({ session }) {
      console.log("[auth:event] session — userId:", session.user?.id);
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;
