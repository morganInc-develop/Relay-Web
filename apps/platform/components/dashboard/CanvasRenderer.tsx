"use client"

import type { ReactNode } from "react"

type Props = Record<string, string>

function buttonVariantClass(variant: string): string {
  switch (variant) {
    case "secondary":
      return "bg-slate-100 text-slate-900 hover:bg-slate-200"
    case "outline":
      return "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
    case "ghost":
      return "bg-transparent text-slate-900 hover:bg-slate-100"
    default:
      return "bg-slate-900 text-white hover:bg-slate-700"
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
          className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition ${buttonVariantClass(
            props.variant ?? "primary"
          )}`}
        >
          {props.label ?? "Button"}
        </button>
      )
    case "Card":
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900">{props.title ?? "Card Title"}</h3>
          <p className="mt-1 text-sm text-slate-600">{props.content ?? "Card body text."}</p>
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

      return <Tag className={`font-bold text-slate-900 ${sizeClass}`}>{props.text ?? "Heading"}</Tag>
    }
    case "Paragraph":
      return <p className="text-sm leading-6 text-slate-700">{props.text ?? "Paragraph text."}</p>
    case "Alert":
      return (
        <div className={`rounded-lg border p-3 text-sm ${alertVariantClass(props.variant ?? "info")}`}>
          {props.message ?? "Alert message."}
        </div>
      )
    default:
      return (
        <div className="rounded border border-dashed border-slate-300 p-3 text-xs text-slate-400">
          {type}
        </div>
      )
  }
}
