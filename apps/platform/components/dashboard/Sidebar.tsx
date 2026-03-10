"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart,
  Blocks,
  FileText,
  LayoutDashboard,
  Palette,
  Search,
  Settings,
} from "lucide-react";

import SignOutButton from "@/components/auth/SignOutButton";

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
  icon: React.ComponentType<{ className?: string }>;
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
      icon: LayoutDashboard,
      href: "/dashboard",
      show: true,
    },
    {
      label: "Content",
      icon: FileText,
      href: "/dashboard/content",
      show: true,
    },
    {
      label: "SEO",
      icon: Search,
      href: "/dashboard/seo",
      show: true,
    },
    {
      label: "Analytics",
      icon: BarChart,
      href: "/dashboard/analytics",
      show: true,
    },
    {
      label: "Design",
      icon: Palette,
      href: "/dashboard/design",
      show: showDesign,
    },
    {
      label: "Components",
      icon: Blocks,
      href: "/dashboard/components",
      show: showComponents,
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/dashboard/settings",
      show: true,
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[240px] border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 px-6 py-5">
        <p className="text-xl font-bold tracking-tight text-slate-900">RelayWeb</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.filter((item) => item.show).map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-4 py-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-100 p-3">
          {userImage ? (
            <img
              src={userImage}
              alt={`${userName} avatar`}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-300 text-sm font-semibold text-slate-700">
              {userName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
            <p className="truncate text-xs text-slate-600">{userEmail}</p>
          </div>
        </div>

        <SignOutButton className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800" />
      </div>
    </aside>
  );
}
