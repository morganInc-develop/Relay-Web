import { redirect } from "next/navigation";
import { RiTeamLine } from "react-icons/ri";

import PageHeader from "@/components/dashboard/PageHeader";
import TeamManager from "@/components/site/TeamManager";
import AnimatedPage from "@/components/ui/AnimatedPage";
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
      <AnimatedPage className="rw-page-shell rw-page-shell--narrow">
        <div className="rw-card border-dashed p-8 text-center">
          <RiTeamLine className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">Team</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Connect your site first before managing team members.
          </p>
        </div>
      </AnimatedPage>
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
    <AnimatedPage className="rw-page-shell rw-page-shell--narrow space-y-8">
      <PageHeader
        title="Team"
        description="Manage workspace members, track pending invites, and control ownership access for your site."
      />
      <TeamManager
        siteId={site.id}
        members={members}
        pendingInvites={pendingInvites}
        currentUserId={session.user.id}
      />
    </AnimatedPage>
  );
}
