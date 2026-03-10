import type { ReactNode } from "react";
import { SubscriptionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import Sidebar from "@/components/dashboard/Sidebar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: Props) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { tier: true, status: true },
  });

  if (subscription?.status !== SubscriptionStatus.ACTIVE) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        tier={subscription.tier}
        userName={session.user.name ?? "RelayWeb User"}
        userEmail={session.user.email ?? ""}
        userImage={session.user.image ?? null}
      />
      <main className="ml-0 min-h-screen p-6 md:ml-[240px] md:p-8">{children}</main>
    </div>
  );
}
