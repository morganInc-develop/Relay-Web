"use client";

import type { ReactNode } from "react";
import { signOut } from "next-auth/react";

type Props = {
  className?: string;
  icon?: ReactNode;
  label?: string;
};

export default function SignOutButton({
  className,
  icon,
  label = "Sign out",
}: Props) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={className}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
