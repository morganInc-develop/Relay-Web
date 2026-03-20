"use client";

import { RiCheckboxCircleLine, RiSparklingLine } from "react-icons/ri";

import ScrollAnimationWrapper from "@/components/landing/ScrollAnimationWrapper";

const proofPoints = [
  "Content, SEO, design, and billing controls live under one login.",
  "AI changes stay gated behind explicit confirmation before publish.",
  "Structured data, sitemap, scripts, and white-label controls live in the same product.",
];

const highlights = [
  {
    image: "/marketing/relay-dashboard-overview.png",
    title: "Operations overview",
    copy: "A live dashboard snapshot with current plan, quick actions, and recent activity.",
  },
  {
    image: "/marketing/relay-design-controls.png",
    title: "Design controls",
    copy: "Brand colors, gradients, and typography managed from a single design surface.",
  },
  {
    image: "/marketing/relay-component-builder.png",
    title: "Component builder",
    copy: "AI-assisted generation and canvas assembly for layout-level changes.",
  },
];

export default function TestimonialsSection() {
  return (
    <section id="proof" className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <ScrollAnimationWrapper className="rw-card-elevated overflow-hidden p-8 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div>
              <span className="rw-eyebrow">Product Proof</span>
              <h2 className="mt-5 text-3xl font-bold tracking-[-0.03em] text-[var(--text-primary)] sm:text-4xl">
                Real product surfaces, not placeholder claims.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                The landing page uses live Relay Web captures and product facts drawn directly from the current platform.
              </p>
              <ul className="mt-6 space-y-3">
                {proofPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                    <RiCheckboxCircleLine className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-500)]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {highlights.map((highlight) => (
                <article key={highlight.title} className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={highlight.image}
                    alt={highlight.title}
                    className="h-44 w-full object-cover"
                  />
                  <div className="p-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-muted)]">
                      <RiSparklingLine className="h-3.5 w-3.5 text-[var(--accent-500)]" />
                      Live capture
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">{highlight.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{highlight.copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </ScrollAnimationWrapper>
      </div>
    </section>
  );
}
