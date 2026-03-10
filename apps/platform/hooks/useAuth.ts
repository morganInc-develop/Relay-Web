"use client";

import { useSession } from "next-auth/react";

export function useAuth() {
  const { data, status } = useSession();

  return {
    user: data?.user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    tier: data?.user?.tier ?? null,
  };
}
