import type { CollectionConfig } from "payload"

export const Media: CollectionConfig = {
  slug: "media",
  admin: {
    useAsTitle: "filename",
  },
  access: {
    read: () => true,
  },
  upload: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"],
    imageSizes: [
      {
        name: "thumbnail",
        width: 400,
        height: 300,
        position: "center",
      },
      {
        name: "card",
        width: 768,
        height: 576,
        position: "center",
      },
      {
        name: "hero",
        width: 1920,
        height: 1080,
        position: "center",
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      label: "Alt Text",
      required: true,
      admin: {
        description: "Describe the image for accessibility and SEO",
      },
    },
    {
      name: "caption",
      type: "text",
      label: "Caption",
    },
  ],
}
