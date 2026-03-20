"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { RiCloseLine, RiMenu3Line } from "react-icons/ri";

import ThemeToggle from "@/components/ui/ThemeToggle";

gsap.registerPlugin(ScrollTrigger);

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#proof", label: "Proof" },
  { href: "#contact", label: "Contact" },
];

export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      start: 16,
      onUpdate: (self) => setScrolled(self.scroll() > 16),
    });

    return () => trigger.kill();
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[var(--border-subtle)] bg-[color:rgba(8,12,18,0.85)] backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
          Relay Web
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Link href="/auth/signin" className="rw-btn rw-btn-secondary">
            Sign In
          </Link>
          <Link href="/onboarding" className="rw-btn rw-btn-primary">
            Start Free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="rw-btn rw-btn-secondary px-3 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <RiCloseLine className="h-5 w-5" /> : <RiMenu3Line className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-4 md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-3">
              <div className="flex items-center justify-between">
                <ThemeToggle />
              </div>
              {navLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Link href="/auth/signin" className="rw-btn rw-btn-secondary justify-center" onClick={() => setMenuOpen(false)}>
                  Sign In
                </Link>
                <Link href="/onboarding" className="rw-btn rw-btn-primary justify-center" onClick={() => setMenuOpen(false)}>
                  Start Free
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
