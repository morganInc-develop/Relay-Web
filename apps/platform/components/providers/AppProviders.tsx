"use client";

import type { ReactNode } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";

import SessionProvider from "@/components/providers/SessionProvider";

function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === "light" ? "light" : "dark"}
      richColors
      closeButton
      toastOptions={{
        style: {
          background: "var(--bg-overlay)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          borderRadius: "var(--radius-md)",
        },
      }}
    />
  );
}

type AppProvidersProps = {
  children: ReactNode;
};

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem themes={["dark", "light"]}>
        {children}
        <AppToaster />
      </ThemeProvider>
    </SessionProvider>
  );
}
