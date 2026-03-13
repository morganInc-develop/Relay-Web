import type { GlobalConfig } from "payload"
import { triggerRebuild } from "../lib/triggerRebuild"

export const Navigation: GlobalConfig = {
  slug: "navigation",
  label: "Navigation",
  admin: {
    group: "Global Settings",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "navItems",
      type: "array",
      label: "Navigation Items",
      fields: [
        {
          name: "label",
          type: "text",
          label: "Label",
          required: true,
        },
        {
          name: "link",
          type: "text",
          label: "URL",
          required: true,
        },
        {
          name: "openInNewTab",
          type: "checkbox",
          label: "Open in new tab",
          defaultValue: false,
        },
        {
          name: "order",
          type: "number",
          label: "Order",
          defaultValue: 0,
        },
      ],
    },
    {
      name: "ctaButton",
      type: "group",
      label: "CTA Button",
      fields: [
        { name: "label", type: "text", label: "Button Label" },
        { name: "link", type: "text", label: "Button Link" },
      ],
    },
  ],
  hooks: {
    afterChange: [
      async (args: any) => {
        await triggerRebuild({
          source: "payload-navigation",
          pageSlug: "global",
          operation: args?.operation ?? "update",
        })
      },
    ],
  },
}
