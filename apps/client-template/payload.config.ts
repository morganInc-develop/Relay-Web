import { buildConfig } from "payload"
import { lexicalEditor } from "@payloadcms/richtext-lexical"
import { postgresAdapter } from "@payloadcms/db-postgres"
import { Pages } from "./collections/Pages.ts"
import { Media } from "./collections/Media.ts"
import { SiteSettings } from "./collections/SiteSettings.ts"
import { Navigation } from "./collections/Navigation.ts"
import { Users } from "./collections/Users.ts"
import sharp from "sharp"

export default buildConfig({
  admin: {
    user: "users",
    meta: {
      titleSuffix: "— RelayWeb CMS",
    },
  },
  editor: lexicalEditor({}),
  collections: [Users, Pages, Media],
  globals: [SiteSettings, Navigation],
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: "./payload-types.ts",
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || "",
    },
  }),
  sharp,
  plugins: [],
})
