"use client";

import type { ReactNode } from "react";

import ThemeToggle from "@/components/ui/ThemeToggle";

interface StandaloneShellProps {
  children: ReactNode;
  centered?: boolean;
  className?: string;
  innerClassName?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "5xl";
  panel?: boolean;
}

const widthClassMap: Record<NonNullable<StandaloneShellProps["maxWidth"]>, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "4xl": "max-w-6xl",
  "5xl": "max-w-7xl",
};

export default function StandaloneShell({
  children,
  centered = true,
  className = "",
  innerClassName = "",
  maxWidth = "md",
  panel = true,
}: StandaloneShellProps) {
  const outerClassName = centered
    ? "mx-auto flex min-h-[calc(100vh-3rem)] w-full items-center justify-center"
    : "mx-auto w-full pb-12 pt-20";

  const containerClassName = `${outerClassName} ${widthClassMap[maxWidth]} ${className}`.trim();
  const contentClassName = panel
    ? `rw-card-elevated w-full p-8 sm:p-10 ${innerClassName}`.trim()
    : `w-full ${innerClassName}`.trim();

  return (
    <div className="rw-standalone-shell relative min-h-screen px-4 py-6 sm:px-6">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className={containerClassName}>
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  );
}
