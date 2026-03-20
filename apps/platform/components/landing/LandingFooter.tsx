"use client";

import Link from "next/link";
import { RiMailLine } from "react-icons/ri";

import ScrollAnimationWrapper from "@/components/landing/ScrollAnimationWrapper";

const columns = {
  Product: [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "/auth/signin", label: "Sign In" },
  ],
  Company: [
    { href: "#proof", label: "Proof" },
    { href: "/onboarding", label: "Get Started" },
    { href: "mailto:hello@morgandev.studio", label: "Contact" },
  ],
  Legal: [
    { href: "/auth/signin", label: "Terms" },
    { href: "/auth/signin", label: "Privacy" },
  ],
};

export default function LandingFooter() {
  return (
    <footer id="contact" className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-16 sm:px-6 sm:pb-10">
      <div className="mx-auto max-w-7xl">
        <ScrollAnimationWrapper animation="fadeIn">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,160px))]">
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">Relay Web</p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--text-secondary)]">
                White-label client control for modern websites, built by MorganDev Studio.
              </p>
            </div>

            {Object.entries(columns).map(([label, links]) => (
              <div key={label}>
                <p className="rw-kicker">{label}</p>
                <div className="mt-4 flex flex-col gap-3">
                  {links.map((link) =>
                    link.href.startsWith("/") ? (
                      <Link
                        key={link.label}
                        href={link.href}
                        className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        key={link.label}
                        href={link.href}
                        className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                      >
                        {link.label}
                      </a>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-6 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 MorganDev Studio. All rights reserved.</p>
            <a href="mailto:hello@morgandev.studio" className="inline-flex items-center gap-2 transition hover:text-[var(--text-primary)]">
              <RiMailLine className="h-4 w-4 text-[var(--accent-500)]" />
              hello@morgandev.studio
            </a>
          </div>
        </ScrollAnimationWrapper>
      </div>
    </footer>
  );
}
