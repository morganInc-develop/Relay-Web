"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  RiBarChartBoxLine,
  RiFileTextLine,
  RiLayoutLine,
  RiPaletteLine,
  RiRobot2Line,
  RiSearchLine,
} from "react-icons/ri";

import ScrollAnimationWrapper from "@/components/landing/ScrollAnimationWrapper";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: RiFileTextLine,
    title: "Live Content Editing",
    description: "Update text, images, and SEO tags directly from your dashboard. Changes publish without a CMS handoff.",
    tier: "All tiers",
  },
  {
    icon: RiRobot2Line,
    title: "AI Chat Editing",
    description: "Describe a change in plain English, review the proposal, and confirm before anything touches production.",
    tier: "All tiers",
  },
  {
    icon: RiPaletteLine,
    title: "Design Controls",
    description: "Adjust colors, gradients, and font pairs with live preview before triggering a rebuild.",
    tier: "Growth+",
  },
  {
    icon: RiSearchLine,
    title: "SEO Audit & Auto-Fix",
    description: "Run scored audits on live pages and apply AI-assisted metadata fixes from the same workflow.",
    tier: "Growth+",
  },
  {
    icon: RiLayoutLine,
    title: "Component Builder",
    description: "Generate React components, review a sandboxed preview, and drop them onto a saved page canvas.",
    tier: "Pro",
  },
  {
    icon: RiBarChartBoxLine,
    title: "Analytics Dashboard",
    description: "Track traffic, acquisition, device mix, and top pages from the same client-facing workspace.",
    tier: "All tiers",
  },
];

export default function FeaturesSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const element = gridRef.current;
    const cards = element.querySelectorAll(".feature-card");

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: element,
        start: "top 80%",
        once: true,
        onEnter: () => {
          gsap.from(cards, {
            opacity: 0,
            y: 30,
            duration: 0.6,
            stagger: 0.1,
            ease: "power3.out",
          });
        },
      });
    }, element);

    return () => ctx.revert();
  }, []);

  return (
    <section id="features" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <ScrollAnimationWrapper className="mx-auto max-w-2xl text-center">
          <span className="rw-eyebrow justify-center">Features</span>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.03em] text-[var(--text-primary)] sm:text-5xl">
            Every client-site workflow, designed into one surface.
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
            Relay Web combines content, SEO, design, analytics, and AI controls in a dashboard clients can actually use.
          </p>
        </ScrollAnimationWrapper>

        <div ref={gridRef} className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, description, tier }) => (
            <article
              key={title}
              className="feature-card rw-card-interactive rw-card min-h-[220px] p-7"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--accent-500)]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-6 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
                <span className="rw-pill shrink-0">{tier}</span>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
