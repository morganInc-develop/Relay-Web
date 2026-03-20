"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ScrollAnimationWrapperProps {
  animation?: "fadeUp" | "fadeIn" | "slideLeft" | "slideRight" | "scaleUp";
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const animationMap = {
  fadeUp: { from: { opacity: 0, y: 40 }, to: { opacity: 1, y: 0 } },
  fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
  slideLeft: { from: { opacity: 0, x: -40 }, to: { opacity: 1, x: 0 } },
  slideRight: { from: { opacity: 0, x: 40 }, to: { opacity: 1, x: 0 } },
  scaleUp: { from: { opacity: 0, scale: 0.94 }, to: { opacity: 1, scale: 1 } },
} as const;

export default function ScrollAnimationWrapper({
  animation = "fadeUp",
  children,
  className,
  delay = 0,
}: ScrollAnimationWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const element = ref.current;
    const { from, to } = animationMap[animation];

    const ctx = gsap.context(() => {
      gsap.set(element, from);

      ScrollTrigger.create({
        trigger: element,
        start: "top 85%",
        once: true,
        onEnter: () => {
          gsap.to(element, {
            ...to,
            delay,
            duration: 0.7,
            ease: "power3.out",
          });
        },
      });
    }, element);

    return () => ctx.revert();
  }, [animation, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
