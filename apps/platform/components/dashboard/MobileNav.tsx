"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { ComponentType } from "react";
import { useState } from "react";
import {
  RiApps2Line,
  RiBarChartLine,
  RiCloseLine,
  RiDashboardLine,
  RiFileTextLine,
  RiGlobalLine,
  RiImageLine,
  RiLayoutLine,
  RiLogoutCircleLine,
  RiMenu3Line,
  RiPaletteLine,
  RiRobot2Line,
  RiSearchLine,
  RiSettings3Line,
  RiTeamLine,
} from "react-icons/ri";

import SignOutButton from "@/components/auth/SignOutButton";
import ThemeToggle from "@/components/ui/ThemeToggle";

type Tier = "TIER1" | "TIER2" | "TIER3";

type MobileNavProps = {
  tier: Tier;
  userName: string;
  userEmail: string;
  userImage: string | null;
};

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  show: boolean;
};

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileNav({ tier, userName, userEmail, userImage }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const showDesign = tier === "TIER2" || tier === "TIER3";
  const showComponents = tier === "TIER3";

  const navItems: NavItem[] = [
    { label: "Overview", icon: RiDashboardLine, href: "/dashboard", show: true },
    { href: "/dashboard/site", label: "My Site", icon: RiGlobalLine, show: true },
    { label: "Content", icon: RiFileTextLine, href: "/dashboard/content", show: true },
    { label: "SEO", icon: RiSearchLine, href: "/dashboard/seo", show: true },
    { label: "AI", icon: RiRobot2Line, href: "/dashboard/ai", show: true },
    { label: "Analytics", icon: RiBarChartLine, href: "/dashboard/analytics", show: true },
    { label: "Team", icon: RiTeamLine, href: "/dashboard/team", show: true },
    { label: "Media", icon: RiImageLine, href: "/dashboard/media", show: true },
    { label: "Design", icon: RiPaletteLine, href: "/dashboard/design", show: showDesign },
    { label: "Layout", icon: RiLayoutLine, href: "/dashboard/layout", show: showDesign },
    { label: "Components", icon: RiApps2Line, href: "/dashboard/components", show: showComponents },
    { label: "Settings", icon: RiSettings3Line, href: "/dashboard/settings", show: true },
  ];

  return (
    <div className="md:hidden">
      <header className="fixed inset-x-0 top-0 z-50 flex h-[60px] items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
        <Link href="/dashboard" className="text-[17px] font-bold tracking-tight text-[var(--text-primary)]">
          RelayWeb
        </Link>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label="Toggle dashboard navigation"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-primary)]"
        >
          {open ? <RiCloseLine className="h-5 w-5" /> : <RiMenu3Line className="h-5 w-5" />}
        </button>
      </header>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close dashboard navigation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/45"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] pt-[60px]"
            >
              <nav className="rw-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
                {navItems.filter((item) => item.show).map((item) => {
                  const Icon = item.icon;
                  const active = isActiveRoute(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex h-11 items-center gap-3 rounded-md border-l-2 px-3 text-sm font-medium transition ${
                        active
                          ? "border-[var(--accent-500)] bg-[var(--bg-elevated)] pl-[10px] text-[var(--text-primary)]"
                          : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-[var(--border-subtle)] px-3 py-4">
                <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Theme
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">Dark, light, or system</p>
                  </div>
                  <ThemeToggle />
                </div>

                <div className="mb-3 flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
                  {userImage ? (
                    <Image
                      src={userImage}
                      alt={`${userName} avatar`}
                      width={36}
                      height={36}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-overlay)] text-sm font-semibold text-[var(--text-primary)]">
                      {userName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{userName}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{userEmail}</p>
                  </div>
                </div>

                <SignOutButton
                  icon={<RiLogoutCircleLine size={18} />}
                  className="rw-btn rw-btn-secondary w-full justify-between"
                />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
