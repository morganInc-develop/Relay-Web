import { Prisma, SubscriptionStatus, type SubscriptionTier } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type UserWithSubscription = Prisma.UserGetPayload<{
  include: { subscription: true };
}>;

export async function getCurrentUser(): Promise<UserWithSubscription | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });
}

export async function requireAuth(): Promise<UserWithSubscription> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/signin");
  }

  return user;
}

export async function requireSubscription(): Promise<UserWithSubscription> {
  const user = await requireAuth();

  if (user.subscription?.status !== SubscriptionStatus.ACTIVE) {
    redirect("/onboarding");
  }

  return user;
}

export async function getUserTier(): Promise<SubscriptionTier | null> {
  const user = await getCurrentUser();
  return user?.subscription?.tier ?? null;
}
