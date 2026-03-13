import type { GlobalConfig } from "payload"
import { triggerRebuild } from "../lib/triggerRebuild"

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Site Settings",
  admin: {
    group: "Global Settings",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "siteName",
      type: "text",
      label: "Site Name",
      required: true,
    },
    {
      name: "siteTagline",
      type: "text",
      label: "Site Tagline",
    },
    {
      name: "logo",
      type: "upload",
      relationTo: "media",
      label: "Site Logo",
    },
    {
      name: "favicon",
      type: "upload",
      relationTo: "media",
      label: "Favicon",
    },
    {
      name: "primaryColor",
      type: "text",
      label: "Primary Brand Color",
      admin: {
        description: "Hex color code e.g. #1E3A5F",
      },
    },
    {
      name: "contactEmail",
      type: "email",
      label: "Contact Email",
    },
    {
      name: "contactPhone",
      type: "text",
      label: "Contact Phone",
    },
    {
      name: "address",
      type: "textarea",
      label: "Business Address",
    },
    {
      name: "socialLinks",
      type: "group",
      label: "Social Media Links",
      fields: [
        { name: "facebook", type: "text", label: "Facebook URL" },
        { name: "instagram", type: "text", label: "Instagram URL" },
        { name: "twitter", type: "text", label: "Twitter/X URL" },
        { name: "linkedin", type: "text", label: "LinkedIn URL" },
        { name: "youtube", type: "text", label: "YouTube URL" },
      ],
    },
    {
      name: "footerText",
      type: "text",
      label: "Footer Copyright Text",
    },
  ],
  hooks: {
    afterChange: [
      async (args: any) => {
        await triggerRebuild({
          source: "payload-site-settings",
          pageSlug: "global",
          operation: args?.operation ?? "update",
        })
      },
    ],
  },
}
