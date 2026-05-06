import { redirect } from "next/navigation";

import InviteAcceptClient from "@/app/invite/accept/InviteAcceptClient";
import { auth } from "@/lib/auth";

type InviteAcceptPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function InviteAcceptPage({ searchParams }: InviteAcceptPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.trim() : "";

  if (!token) {
    redirect("/auth/error?error=InviteTokenMissing");
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/invite/accept?token=${token}`)}`);
  }

  return <InviteAcceptClient token={token} />;
}
