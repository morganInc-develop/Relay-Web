import { redirect } from "next/navigation";

import TeamManager from "@/components/site/TeamManager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  });

  if (subscription?.status !== "ACTIVE") redirect("/onboarding");

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!site) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-600">
            Connect your site first before managing team members.
          </p>
        </div>
      </main>
    );
  }

  const members = await prisma.siteMember.findMany({
    where: { siteId: site.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const pendingInvites = await prisma.teamInvite.findMany({
    where: {
      siteId: site.id,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Team</h1>
      <p className="mb-8 text-sm text-slate-500">
        Manage your site members and send invitations to collaborators.
      </p>
      <TeamManager
        siteId={site.id}
        members={members}
        pendingInvites={pendingInvites}
        currentUserId={session.user.id}
      />
    </main>
  );
}
