"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  RiApps2Line,
  RiBarChartLine,
  RiDashboardLine,
  RiFileTextLine,
  RiGlobalLine,
  RiLayoutLine,
  RiLogoutCircleLine,
  RiPaletteLine,
  RiRobot2Line,
  RiSearchLine,
  RiSettings3Line,
  RiTeamLine,
} from "react-icons/ri";

import SignOutButton from "@/components/auth/SignOutButton";
import ThemeToggle from "@/components/ui/ThemeToggle";

type Tier = "TIER1" | "TIER2" | "TIER3";

type SidebarProps = {
  tier: Tier;
  userName: string;
  userEmail: string;
  userImage: string | null;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  show: boolean;
};

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({
  tier,
  userName,
  userEmail,
  userImage,
}: SidebarProps) {
  const pathname = usePathname();
  const showDesign = tier === "TIER2" || tier === "TIER3";
  const showComponents = tier === "TIER3";

  const navItems: NavItem[] = [
    {
      label: "Overview",
      icon: RiDashboardLine,
      href: "/dashboard",
      show: true,
    },
    {
      href: "/dashboard/site",
      label: "My Site",
      icon: RiGlobalLine,
      show: true,
    },
    {
      label: "Content",
      icon: RiFileTextLine,
      href: "/dashboard/content",
      show: true,
    },
    {
      label: "SEO",
      icon: RiSearchLine,
      href: "/dashboard/seo",
      show: true,
    },
    {
      label: "AI",
      icon: RiRobot2Line,
      href: "/dashboard/ai",
      show: true,
    },
    {
      label: "Analytics",
      icon: RiBarChartLine,
      href: "/dashboard/analytics",
      show: true,
    },
    {
      label: "Team",
      icon: RiTeamLine,
      href: "/dashboard/team",
      show: true,
    },
    {
      label: "Design",
      icon: RiPaletteLine,
      href: "/dashboard/design",
      show: showDesign,
    },
    {
      label: "Layout",
      icon: RiLayoutLine,
      href: "/dashboard/layout",
      show: showDesign,
    },
    {
      label: "Components",
      icon: RiApps2Line,
      href: "/dashboard/components",
      show: showComponents,
    },
    {
      label: "Settings",
      icon: RiSettings3Line,
      href: "/dashboard/settings",
      show: true,
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] md:flex">
      <div className="flex h-[60px] items-center border-b border-[var(--border-subtle)] px-5">
        <p className="text-[17px] font-bold tracking-tight text-[var(--text-primary)]">
          RelayWeb
        </p>
      </div>

      <nav className="rw-scrollbar flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.filter((item) => item.show).map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(pathname, item.href);

          return (
            <motion.div
              key={item.href}
              whileHover={{ x: 2 }}
              transition={{ duration: 0.15 }}
            >
              <Link
                href={item.href}
                className={`mx-1 flex h-10 items-center gap-3 rounded-md border-l-2 px-3 text-[13.5px] font-medium transition ${
                  active
                    ? "border-[var(--accent-500)] bg-[var(--bg-elevated)] pl-[10px] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            </motion.div>
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

        <div className="mb-3 flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-sm)]">
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
    </aside>
  );
}
