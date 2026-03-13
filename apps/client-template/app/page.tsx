import { getPayload } from "payload"
import config from "@payload-config"

export default async function Home() {
  const payload = await getPayload({ config })

  const pages = await payload.find({
    collection: "pages",
    where: {
      slug: { equals: "home" },
    },
    limit: 1,
  })

  const homePage = pages.docs[0]

  const siteSettings = await payload.findGlobal({
    slug: "site-settings",
  })

  if (!homePage) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {siteSettings?.siteName ?? "Welcome"}
          </h1>
          <p className="text-gray-500">
            {siteSettings?.siteTagline ?? "Your site is being set up."}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      {homePage.hero && (
        <section className="bg-gray-900 text-white py-24 px-6">
          <div className="max-w-4xl mx-auto text-center">
            {homePage.hero.heading && (
              <h1 className="text-5xl font-bold mb-6">{homePage.hero.heading}</h1>
            )}
            {homePage.hero.subheading && (
              <p className="text-xl text-gray-300 mb-8">{homePage.hero.subheading}</p>
            )}
            {homePage.hero.ctaText && homePage.hero.ctaLink && (
              <a
                href={homePage.hero.ctaLink}
                className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                {homePage.hero.ctaText}
              </a>
            )}
          </div>
        </section>
      )}

      {homePage.sections && homePage.sections.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-16">
          {homePage.sections
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
            .map((section: any, index: number) => (
              <section key={index}>
                {section.heading && (
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">{section.heading}</h2>
                )}
              </section>
            ))}
        </div>
      )}
    </main>
  )
}
