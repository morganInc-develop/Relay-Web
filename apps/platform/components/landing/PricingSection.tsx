"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { RiCheckLine } from "react-icons/ri";

import ScrollAnimationWrapper from "@/components/landing/ScrollAnimationWrapper";
import { buttonHover, buttonTap } from "@/lib/motion-variants";

const tiers = [
  {
    name: "Starter",
    price: "$50",
    description: "Perfect for getting started with client editing.",
    features: [
      "Text and SEO editing",
      "AI chatbot editing",
      "Analytics dashboard",
      "10 versions per field",
      "Scheduled publishing",
      "Multi-user accounts",
    ],
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Growth",
    price: "$100",
    description: "Add design controls and layout flexibility.",
    features: [
      "Everything in Starter",
      "Color and gradient editor",
      "Font pairing controls",
      "Component swapping",
      "Section drag-and-drop",
      "Live preview iframe",
      "AI SEO auto-fix",
    ],
    cta: "Start Growing",
    featured: true,
  },
  {
    name: "Pro",
    price: "$200",
    description: "Full control. AI generation. White-label ready.",
    features: [
      "Everything in Growth",
      "AI component generation",
      "Drag-and-drop canvas",
      "Script injection",
      "White-label dashboard URL",
      "Structured data editor",
      "Sitemap management",
    ],
    cta: "Go Pro",
    featured: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <ScrollAnimationWrapper className="mx-auto max-w-2xl text-center">
          <span className="rw-eyebrow justify-center">Pricing</span>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.03em] text-[var(--text-primary)] sm:text-5xl">
            Choose the control surface your clients need.
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
            Start with editing essentials, then unlock design, layout, and AI generation as your agency stack expands.
          </p>
        </ScrollAnimationWrapper>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <ScrollAnimationWrapper key={tier.name} animation="scaleUp">
              <article
                className={`h-full rounded-[20px] p-7 ${
                  tier.featured
                    ? "border border-[var(--border-accent)] bg-[var(--bg-elevated)] shadow-[0_0_40px_var(--accent-glow)]"
                    : "rw-card"
                }`}
              >
                {tier.featured ? <span className="rw-badge">Most Popular</span> : null}
                <h3 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">{tier.name}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{tier.description}</p>
                <div className="mt-6 flex items-end gap-2">
                  <span className="font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[-0.04em] text-[var(--text-primary)]">
                    {tier.price}
                  </span>
                  <span className="pb-2 text-lg text-[var(--text-muted)]">/mo</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                      <RiCheckLine className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-500)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <motion.div whileHover={buttonHover} whileTap={buttonTap} className="mt-8">
                  <Link
                    href="/onboarding"
                    className={`rw-btn w-full justify-center ${tier.featured ? "rw-btn-primary" : "rw-btn-secondary"}`}
                  >
                    {tier.cta}
                  </Link>
                </motion.div>
              </article>
            </ScrollAnimationWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}
