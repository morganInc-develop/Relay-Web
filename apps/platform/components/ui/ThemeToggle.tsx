"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { RiComputerLine, RiMoonLine, RiSunLine } from "react-icons/ri";

const themes = [
  { value: "dark", label: "Dark", Icon: RiMoonLine },
  { value: "light", label: "Light", Icon: RiSunLine },
  { value: "system", label: "System", Icon: RiComputerLine },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!mounted) return null;

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-[var(--shadow-sm)]"
    >
      {themes.map(({ value, label, Icon }) => {
        const active = theme === value;

        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-label={label}
            aria-pressed={active}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 ${
              active
                ? "bg-[var(--accent-500)] text-white shadow-[var(--shadow-sm)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
