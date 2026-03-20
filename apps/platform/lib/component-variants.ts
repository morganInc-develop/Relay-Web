export interface ComponentVariant {
  id: string
  sectionType: string
  displayName: string
  description: string
}

export const COMPONENT_VARIANTS: ComponentVariant[] = [
  {
    id: "hero-centered",
    sectionType: "hero",
    displayName: "Centered Hero",
    description: "Full-width hero with centered headline and CTA buttons",
  },
  {
    id: "hero-split",
    sectionType: "hero",
    displayName: "Split Hero",
    description: "Headline left, image right — two-column layout",
  },
  {
    id: "hero-minimal",
    sectionType: "hero",
    displayName: "Minimal Hero",
    description: "Compact headline-only, no image",
  },
  {
    id: "features-grid",
    sectionType: "features",
    displayName: "Feature Grid",
    description: "3-column icon + text card grid",
  },
  {
    id: "features-list",
    sectionType: "features",
    displayName: "Feature List",
    description: "Alternating left/right image + text rows",
  },
  {
    id: "testimonials-grid",
    sectionType: "testimonials",
    displayName: "Testimonial Grid",
    description: "Three testimonial cards in a row",
  },
  {
    id: "testimonials-carousel",
    sectionType: "testimonials",
    displayName: "Testimonial Carousel",
    description: "Single testimonial with prev/next arrows",
  },
  {
    id: "cta-banner",
    sectionType: "cta",
    displayName: "Banner CTA",
    description: "Full-width colored band with centered call to action",
  },
  {
    id: "cta-card",
    sectionType: "cta",
    displayName: "Card CTA",
    description: "Centered card with shadow, headline, and two buttons",
  },
]

export const DEFAULT_SECTION_ORDER = ["hero", "features", "testimonials", "cta"]

export const VALID_SECTION_TYPES = new Set(["hero", "features", "testimonials", "cta"])

export const VALID_VARIANT_IDS = new Set(COMPONENT_VARIANTS.map((variant) => variant.id))

export function getVariantsForSection(sectionType: string): ComponentVariant[] {
  return COMPONENT_VARIANTS.filter((variant) => variant.sectionType === sectionType)
}

export function getVariantById(id: string): ComponentVariant | undefined {
  return COMPONENT_VARIANTS.find((variant) => variant.id === id)
}
