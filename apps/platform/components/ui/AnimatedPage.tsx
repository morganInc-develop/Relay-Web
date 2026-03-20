"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { fadeUp } from "@/lib/motion-variants";

type AnimatedPageProps = {
  children: ReactNode;
  className?: string;
};

export default function AnimatedPage({ children, className }: AnimatedPageProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} initial="hidden" animate="visible" variants={fadeUp}>
      {children}
    </motion.div>
  );
}
