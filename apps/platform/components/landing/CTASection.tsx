"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { RiArrowRightLine } from "react-icons/ri";

import ScrollAnimationWrapper from "@/components/landing/ScrollAnimationWrapper";
import { buttonHover, buttonTap } from "@/lib/motion-variants";

export default function CTASection() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-6xl">
        <ScrollAnimationWrapper className="overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[linear-gradient(145deg,rgba(96,165,250,0.14),rgba(13,17,23,0.94)_36%,rgba(8,12,18,1)_100%)] px-8 py-12 shadow-[var(--shadow-lg)] sm:px-12">
          <div className="max-w-3xl">
            <span className="rw-eyebrow">Start now</span>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.03em] text-[var(--text-primary)] sm:text-5xl">
              Give clients a dashboard that feels as polished as the site it controls.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
              Relay Web keeps edits, approvals, SEO, design, and reporting in one product so agencies stop stitching together fragmented tools.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                <Link href="/onboarding" className="rw-btn rw-btn-primary h-12 px-7">
                  Start Free
                  <RiArrowRightLine className="h-4 w-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                <Link href="/auth/signin" className="rw-btn rw-btn-secondary h-12 px-7">
                  Sign In
                </Link>
              </motion.div>
            </div>
          </div>
        </ScrollAnimationWrapper>
      </div>
    </section>
  );
}
