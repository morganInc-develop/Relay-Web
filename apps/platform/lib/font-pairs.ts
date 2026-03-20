export interface FontPair {
  id: string
  displayName: string
  headingFamily: string
  bodyFamily: string
  headingPackage: string
  bodyPackage: string
}

export const FONT_PAIRS: FontPair[] = [
  {
    id: "inter-playfair",
    displayName: "Inter + Playfair Display",
    headingFamily: "'Playfair Display', serif",
    bodyFamily: "'Inter', sans-serif",
    headingPackage: "@fontsource/playfair-display",
    bodyPackage: "@fontsource/inter",
  },
  {
    id: "inter-fraunces",
    displayName: "Inter + Fraunces",
    headingFamily: "'Fraunces', serif",
    bodyFamily: "'Inter', sans-serif",
    headingPackage: "@fontsource/fraunces",
    bodyPackage: "@fontsource/inter",
  },
  {
    id: "dm-sans-dm-serif",
    displayName: "DM Sans + DM Serif Display",
    headingFamily: "'DM Serif Display', serif",
    bodyFamily: "'DM Sans', sans-serif",
    headingPackage: "@fontsource/dm-serif-display",
    bodyPackage: "@fontsource/dm-sans",
  },
  {
    id: "manrope-cormorant",
    displayName: "Manrope + Cormorant",
    headingFamily: "'Cormorant Garamond', serif",
    bodyFamily: "'Manrope', sans-serif",
    headingPackage: "@fontsource/cormorant-garamond",
    bodyPackage: "@fontsource/manrope",
  },
  {
    id: "outfit-libre-bask",
    displayName: "Outfit + Libre Baskerville",
    headingFamily: "'Libre Baskerville', serif",
    bodyFamily: "'Outfit', sans-serif",
    headingPackage: "@fontsource/libre-baskerville",
    bodyPackage: "@fontsource/outfit",
  },
  {
    id: "lato-josefin",
    displayName: "Lato + Josefin Sans",
    headingFamily: "'Josefin Sans', sans-serif",
    bodyFamily: "'Lato', sans-serif",
    headingPackage: "@fontsource/josefin-sans",
    bodyPackage: "@fontsource/lato",
  },
  {
    id: "nunito-source-serif",
    displayName: "Nunito + Source Serif 4",
    headingFamily: "'Source Serif 4', serif",
    bodyFamily: "'Nunito', sans-serif",
    headingPackage: "@fontsource/source-serif-4",
    bodyPackage: "@fontsource/nunito",
  },
  {
    id: "poppins-fraunces",
    displayName: "Poppins + Fraunces",
    headingFamily: "'Fraunces', serif",
    bodyFamily: "'Poppins', sans-serif",
    headingPackage: "@fontsource/fraunces",
    bodyPackage: "@fontsource/poppins",
  },
]

export const DEFAULT_FONT_PAIR_ID = "inter-playfair"

export function getFontPairById(id: string): FontPair | undefined {
  return FONT_PAIRS.find((pair) => pair.id === id)
}

export const VALID_FONT_PAIR_IDS = new Set(FONT_PAIRS.map((pair) => pair.id))
