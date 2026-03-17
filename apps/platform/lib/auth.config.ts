import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  // Required in NextAuth v5 beta to trust the host in dev/proxy environments
  trustHost: true,
} satisfies NextAuthConfig;

export default authConfig;
