"use client";

import { signOut } from "next-auth/react";

type Props = {
  className?: string;
};

export default function SignOutButton({ className }: Props) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={className}
    >
      Sign out
    </button>
  );
}
