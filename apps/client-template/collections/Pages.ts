import type { CollectionConfig } from "payload"
import { triggerRebuild } from "../lib/triggerRebuild"

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "updatedAt"],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      label: "Page Title",
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      label: "URL Slug",
      admin: {
        description: "The URL path for this page e.g. 'about' or 'services'",
      },
    },
    {
      name: "hero",
      type: "group",
      label: "Hero Section",
      fields: [
        {
          name: "heading",
          type: "text",
          label: "Heading",
        },
        {
          name: "subheading",
          type: "textarea",
          label: "Subheading",
        },
        {
          name: "ctaText",
          type: "text",
          label: "CTA Button Text",
        },
        {
          name: "ctaLink",
          type: "text",
          label: "CTA Button Link",
        },
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          label: "Hero Image",
        },
      ],
    },
    {
      name: "sections",
      type: "array",
      label: "Page Sections",
      fields: [
        {
          name: "sectionType",
          type: "select",
          label: "Section Type",
          options: [
            { label: "Text Block", value: "text" },
            { label: "Image + Text", value: "imageText" },
            { label: "Features Grid", value: "features" },
            { label: "Testimonial", value: "testimonial" },
            { label: "CTA Banner", value: "cta" },
            { label: "Contact Form", value: "contact" },
          ],
        },
        {
          name: "heading",
          type: "text",
          label: "Section Heading",
        },
        {
          name: "body",
          type: "richText",
          label: "Section Body",
        },
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          label: "Section Image",
        },
        {
          name: "order",
          type: "number",
          label: "Display Order",
          defaultValue: 0,
        },
      ],
    },
    {
      name: "meta",
      type: "group",
      label: "SEO Meta",
      fields: [
        {
          name: "title",
          type: "text",
          label: "Meta Title",
          admin: {
            description: "Recommended: 50–60 characters",
          },
        },
        {
          name: "description",
          type: "textarea",
          label: "Meta Description",
          admin: {
            description: "Recommended: 150–160 characters",
          },
        },
        {
          name: "ogImage",
          type: "upload",
          relationTo: "media",
          label: "Open Graph Image",
        },
        {
          name: "noIndex",
          type: "checkbox",
          label: "No Index",
          defaultValue: false,
        },
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      label: "Published At",
      admin: {
        position: "sidebar",
      },
    },
  ],
  timestamps: true,
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        await triggerRebuild({
          source: "payload-pages",
          pageSlug: doc.slug ?? doc.id,
          operation,
        })
      },
    ],
  },
}
