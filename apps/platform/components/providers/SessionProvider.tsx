"use client";

import type { ReactNode } from "react";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

type Props = {
  children: ReactNode;
};

export default function SessionProvider({ children }: Props) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
