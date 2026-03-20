export interface CanvasItem {
  id: string
  componentType: string
  props: Record<string, string>
}

export interface EditableProp {
  key: string
  label: string
  inputType: "text" | "select" | "color"
  options?: string[]
}

export interface CanvasComponentDef {
  type: string
  displayName: string
  defaultProps: Record<string, string>
  editableProps: EditableProp[]
}

export const CANVAS_COMPONENTS: CanvasComponentDef[] = [
  {
    type: "Button",
    displayName: "Button",
    defaultProps: { label: "Click me", variant: "primary" },
    editableProps: [
      { key: "label", label: "Label", inputType: "text" },
      {
        key: "variant",
        label: "Variant",
        inputType: "select",
        options: ["primary", "secondary", "outline", "ghost"],
      },
    ],
  },
  {
    type: "Card",
    displayName: "Card",
    defaultProps: { title: "Card Title", content: "Card body text goes here." },
    editableProps: [
      { key: "title", label: "Title", inputType: "text" },
      { key: "content", label: "Content", inputType: "text" },
    ],
  },
  {
    type: "Badge",
    displayName: "Badge",
    defaultProps: { label: "New", color: "#6366f1" },
    editableProps: [
      { key: "label", label: "Label", inputType: "text" },
      { key: "color", label: "Color", inputType: "color" },
    ],
  },
  {
    type: "Heading",
    displayName: "Heading",
    defaultProps: { text: "Section Heading", size: "h2" },
    editableProps: [
      { key: "text", label: "Text", inputType: "text" },
      { key: "size", label: "Size", inputType: "select", options: ["h1", "h2", "h3"] },
    ],
  },
  {
    type: "Paragraph",
    displayName: "Paragraph",
    defaultProps: { text: "Add your paragraph text here." },
    editableProps: [{ key: "text", label: "Text", inputType: "text" }],
  },
  {
    type: "Alert",
    displayName: "Alert",
    defaultProps: { message: "This is an alert.", variant: "info" },
    editableProps: [
      { key: "message", label: "Message", inputType: "text" },
      {
        key: "variant",
        label: "Variant",
        inputType: "select",
        options: ["info", "success", "warning", "error"],
      },
    ],
  },
]

export const VALID_CANVAS_TYPES = new Set(CANVAS_COMPONENTS.map((component) => component.type))
export const CANVAS_COMPONENT_MAP = new Map(CANVAS_COMPONENTS.map((component) => [component.type, component]))

export function getCanvasComponent(type: string): CanvasComponentDef | undefined {
  return CANVAS_COMPONENT_MAP.get(type)
}

export function getValidPropKeys(type: string): Set<string> {
  const def = CANVAS_COMPONENT_MAP.get(type)
  if (!def) {
    return new Set()
  }

  return new Set(def.editableProps.map((prop) => prop.key))
}
