"use client"

import { getCanvasComponent } from "@/lib/canvas-registry"

interface PropsPanelProps {
  componentType: string
  currentProps: Record<string, string>
  onUpdate: (key: string, value: string) => void
  onClose: () => void
}

export default function PropsPanel({
  componentType,
  currentProps,
  onUpdate,
  onClose,
}: PropsPanelProps) {
  const def = getCanvasComponent(componentType)

  if (!def) {
    return null
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{def.displayName} Props</h3>
          <p className="mt-1 text-xs text-slate-500">Update values to change the canvas preview immediately.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {def.editableProps.map((prop) => (
          <label key={prop.key} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">{prop.label}</span>
            {prop.inputType === "text" ? (
              <input
                type="text"
                value={currentProps[prop.key] ?? ""}
                onChange={(event) => onUpdate(prop.key, event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            ) : null}
            {prop.inputType === "select" ? (
              <select
                value={currentProps[prop.key] ?? ""}
                onChange={(event) => onUpdate(prop.key, event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {(prop.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : null}
            {prop.inputType === "color" ? (
              <input
                type="color"
                value={currentProps[prop.key] ?? "#000000"}
                onChange={(event) => onUpdate(prop.key, event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white p-1 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            ) : null}
          </label>
        ))}
      </div>
    </aside>
  )
}
