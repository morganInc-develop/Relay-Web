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
    <aside className="rw-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{def.displayName} Props</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Update values to change the canvas preview immediately.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rw-btn rw-btn-ghost px-3 py-2 text-xs"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {def.editableProps.map((prop) => (
          <label key={prop.key} className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">{prop.label}</span>
            {prop.inputType === "text" ? (
              <input
                type="text"
                value={currentProps[prop.key] ?? ""}
                onChange={(event) => onUpdate(prop.key, event.target.value)}
                className="rw-input"
              />
            ) : null}
            {prop.inputType === "select" ? (
              <select
                value={currentProps[prop.key] ?? ""}
                onChange={(event) => onUpdate(prop.key, event.target.value)}
                className="rw-select"
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
                className="h-10 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1"
              />
            ) : null}
          </label>
        ))}
      </div>
    </aside>
  )
}
