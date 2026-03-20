"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { RiArrowRightLine, RiSparklingLine } from "react-icons/ri";

import { buttonHover, buttonTap } from "@/lib/motion-variants";

export default function HeroSection() {
  const badgeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 120, damping: 18, mass: 0.3 });
  const smoothY = useSpring(mouseY, { stiffness: 120, damping: 18, mass: 0.3 });
  const rotateX = useTransform(smoothY, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], ["-8deg", "8deg"]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline
        .from(badgeRef.current, { opacity: 0, y: 20, duration: 0.45 })
        .from(headingRef.current, { opacity: 0, y: 30, duration: 0.7 }, "-=0.15")
        .from(subRef.current, { opacity: 0, y: 18, duration: 0.55 }, "-=0.4")
        .from(ctasRef.current, { opacity: 0, y: 18, duration: 0.45 }, "-=0.35")
        .from(imageRef.current, { opacity: 0, y: 40, scale: 0.96, duration: 0.8 }, "-=0.2");
    }, frameRef);

    return () => ctx.revert();
  }, []);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    mouseX.set(x);
    mouseY.set(y);
  };

  return (
    <section ref={frameRef} className="relative overflow-hidden px-4 pb-20 pt-36 sm:px-6 sm:pb-24 sm:pt-40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_28%),radial-gradient(circle_at_70%_20%,rgba(147,197,253,0.08),transparent_26%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]">
        <div className="max-w-2xl">
          <div
            ref={badgeRef}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-accent)] bg-[color:rgba(96,165,250,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-500)]"
          >
            <RiSparklingLine className="h-4 w-4" />
            Now shipping for agency teams
          </div>

          <h1
            ref={headingRef}
            className="mt-6 max-w-4xl font-[family-name:var(--font-display)] text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.04em] text-[var(--text-primary)]"
          >
            The white-label client dashboard that{" "}
            <span className="bg-[linear-gradient(135deg,#60a5fa_0%,#93c5fd_50%,#bfdbfe_100%)] bg-clip-text text-transparent">
              keeps websites moving.
            </span>
          </h1>

          <p
            ref={subRef}
            className="mt-6 max-w-xl text-lg leading-8 text-[var(--text-secondary)]"
          >
            Relay Web gives agencies one control surface for live content edits, SEO cleanup, analytics, design changes, and AI-assisted updates.
          </p>

          <div ref={ctasRef} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <motion.div whileHover={buttonHover} whileTap={buttonTap}>
              <Link href="/onboarding" className="rw-btn rw-btn-primary h-12 px-7 text-sm">
                Start Free
                <RiArrowRightLine className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={buttonHover} whileTap={buttonTap}>
              <a href="#pricing" className="rw-btn rw-btn-secondary h-12 px-7 text-sm">
                View Pricing
              </a>
            </motion.div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <span className="rw-pill">Content + SEO editing</span>
            <span className="rw-pill">Design controls</span>
            <span className="rw-pill">AI component generation</span>
          </div>
        </div>

        <motion.div
          ref={imageRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            mouseX.set(0);
            mouseY.set(0);
          }}
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
          className="relative"
        >
          <div className="absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_center,rgba(96,165,250,0.16),transparent_70%)] blur-3xl" />
            <div className="relative rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-lg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marketing/relay-dashboard-overview.png"
              alt="Relay Web dashboard overview"
              className="h-auto w-full rounded-[18px] border border-[var(--border-subtle)]"
            />
          </div>
          <div className="pointer-events-none absolute -bottom-5 left-5 rounded-2xl border border-[var(--border-default)] bg-[color:rgba(13,17,23,0.92)] px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur-xl">
            <p className="rw-kicker">Live Status</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Edits, SEO, design, and billing in one workspace</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
