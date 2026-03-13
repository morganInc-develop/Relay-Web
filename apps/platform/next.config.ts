import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"
import path from "path"

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry organization and project — update these with your actual values
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in production CI
  silent: !process.env.CI,

  // Disable source map upload during local development
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
})
