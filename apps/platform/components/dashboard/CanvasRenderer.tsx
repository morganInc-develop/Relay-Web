"use client"

import type { ReactNode } from "react"

type Props = Record<string, string>

function buttonVariantClass(variant: string): string {
  switch (variant) {
    case "secondary":
      return "rw-btn rw-btn-secondary"
    case "outline":
      return "rw-btn rw-btn-secondary"
    case "ghost":
      return "rw-btn rw-btn-ghost"
    default:
      return "rw-btn rw-btn-primary"
  }
}

function alertVariantClass(variant: string): string {
  switch (variant) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800"
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-800"
    default:
      return "border-blue-200 bg-blue-50 text-blue-800"
  }
}

export function renderCanvasComponent(type: string, props: Props): ReactNode {
  switch (type) {
    case "Button":
      return (
        <button
          className={buttonVariantClass(props.variant ?? "primary")}
        >
          {props.label ?? "Button"}
        </button>
      )
    case "Card":
      return (
        <div className="rw-card p-4">
          <h3 className="font-semibold text-[var(--text-primary)]">{props.title ?? "Card Title"}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{props.content ?? "Card body text."}</p>
        </div>
      )
    case "Badge":
      return (
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: props.color ?? "#6366f1" }}
        >
          {props.label ?? "Badge"}
        </span>
      )
    case "Heading": {
      const Tag = (props.size ?? "h2") as "h1" | "h2" | "h3"
      const sizeClass =
        props.size === "h1" ? "text-3xl" : props.size === "h3" ? "text-xl" : "text-2xl"

      return <Tag className={`font-bold text-[var(--text-primary)] ${sizeClass}`}>{props.text ?? "Heading"}</Tag>
    }
    case "Paragraph":
      return <p className="text-sm leading-6 text-[var(--text-secondary)]">{props.text ?? "Paragraph text."}</p>
    case "Alert":
      return (
        <div className={`rounded-lg border p-3 text-sm ${alertVariantClass(props.variant ?? "info")}`}>
          {props.message ?? "Alert message."}
        </div>
      )
    default:
      return (
        <div className="rounded border border-dashed border-[var(--border-default)] p-3 text-xs text-[var(--text-muted)]">
          {type}
        </div>
      )
  }
}
