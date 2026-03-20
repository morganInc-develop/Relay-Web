"use client";

import ScrollAnimationWrapper from "@/components/landing/ScrollAnimationWrapper";

const steps = [
  {
    number: "1",
    title: "Pick a tier",
    description: "Choose the level of control your client workspace needs, from editing essentials to full AI generation.",
  },
  {
    number: "2",
    title: "Connect your site",
    description: "Verify the domain, link your repo and Payload setup, and point Relay Web at the live project.",
  },
  {
    number: "3",
    title: "Ship updates",
    description: "Edit content, tune design, run SEO checks, and approve AI suggestions without opening multiple tools.",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <ScrollAnimationWrapper className="mx-auto max-w-2xl text-center">
          <span className="rw-eyebrow justify-center">How it works</span>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
            Go from setup to live edits in three moves.
          </h2>
        </ScrollAnimationWrapper>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <ScrollAnimationWrapper key={step.number} animation="fadeUp" delay={index * 0.08}>
              <div className="rw-card h-full p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-glow)] text-sm font-bold text-[var(--accent-500)]">
                    {step.number}
                  </div>
                  {index < steps.length - 1 ? (
                    <div className="hidden h-px flex-1 bg-[var(--border-subtle)] md:block" />
                  ) : null}
                </div>
                <h3 className="mt-6 text-lg font-semibold text-[var(--text-primary)]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{step.description}</p>
              </div>
            </ScrollAnimationWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}
