import CTASection from "@/components/landing/CTASection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingNav from "@/components/landing/LandingNav";
import LenisProvider from "@/components/landing/LenisProvider";
import PricingSection from "@/components/landing/PricingSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";

export default function HomePage() {
  return (
    <LenisProvider>
      <main
        className="min-h-screen overflow-x-hidden"
        style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
      >
        <LandingNav />
        <HeroSection />
        <TestimonialsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <CTASection />
        <LandingFooter />
      </main>
    </LenisProvider>
  );
}
