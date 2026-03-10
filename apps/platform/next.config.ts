import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // On Vercel the build runs from apps/platform/ but Vercel looks for
  // .next at the repo root. Go up two levels to match.
  distDir: process.env.VERCEL ? "../../.next" : ".next",
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
};

export default nextConfig;
