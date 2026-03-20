"use client"

import { useMemo, useState } from "react"
import { DndProvider, useDrag, useDrop } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"

import PropsPanel from "@/components/dashboard/PropsPanel"
import { renderCanvasComponent } from "@/components/dashboard/CanvasRenderer"
import {
  CANVAS_COMPONENTS,
  getCanvasComponent,
  type CanvasComponentDef,
  type CanvasItem,
} from "@/lib/canvas-registry"

interface ComponentCanvasProps {
  pageSlug: string
  initialLayout: CanvasItem[]
}

interface SidebarItemProps {
  def: CanvasComponentDef
}

interface PlacedCanvasItemProps {
  item: CanvasItem
  index: number
  isSelected: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onMove: (index: number, direction: "up" | "down") => void
}

interface CanvasDropZoneProps {
  layout: CanvasItem[]
  selectedId: string | null
  onDropItem: (item: CanvasItem) => void
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onMove: (index: number, direction: "up" | "down") => void
}

function SidebarItem({ def }: SidebarItemProps) {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: "NEW_COMPONENT",
      item: { componentType: def.type },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [def.type]
  )

  return (
    <div
      ref={(node) => {
        dragRef(node)
      }}
      className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300"
      style={{ opacity: isDragging ? 0.45 : 1 }}
    >
      <p className="text-sm font-medium text-slate-900">{def.displayName}</p>
      <p className="mt-1 text-xs text-slate-500">Drag onto the canvas</p>
    </div>
  )
}

function PlacedCanvasItem({
  item,
  index,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onRemove,
  onMove,
}: PlacedCanvasItemProps) {
  return (
    <div
      className={`relative cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition ${
        isSelected ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200 hover:border-slate-300"
      }`}
      onClick={() => onSelect(item.id)}
    >
      <div className="absolute right-3 top-3 flex items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onMove(index, "up")
          }}
          disabled={isFirst}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onMove(index, "down")
          }}
          disabled={isLast}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove(item.id)
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          ✕
        </button>
      </div>

      <p className="mb-3 pr-24 text-xs font-medium uppercase tracking-wide text-slate-400">
        {item.componentType}
      </p>
      {renderCanvasComponent(item.componentType, item.props)}
    </div>
  )
}

function CanvasDropZone({
  layout,
  selectedId,
  onDropItem,
  onSelect,
  onRemove,
  onMove,
}: CanvasDropZoneProps) {
  const [{ isOver }, dropRef] = useDrop(
    () => ({
      accept: "NEW_COMPONENT",
      drop: (item: { componentType: string }) => {
        const def = getCanvasComponent(item.componentType)
        if (!def) {
          return
        }

        const newItem: CanvasItem = {
          id: crypto.randomUUID(),
          componentType: item.componentType,
          props: { ...def.defaultProps },
        }

        onDropItem(newItem)
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [onDropItem]
  )

  return (
    <div
      ref={(node) => {
        dropRef(node)
      }}
      className={`min-h-[420px] rounded-xl border-2 border-dashed p-4 transition ${
        isOver ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-slate-50/60"
      }`}
    >
      {layout.length === 0 ? (
        <div className="flex h-full min-h-[380px] items-center justify-center rounded-lg bg-white/70 text-center">
          <div>
            <p className="text-sm font-medium text-slate-900">Drop components here</p>
            <p className="mt-1 text-xs text-slate-500">Start with a heading, card, or alert block.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {layout.map((item, index) => (
            <PlacedCanvasItem
              key={item.id}
              item={item}
              index={index}
              isSelected={selectedId === item.id}
              isFirst={index === 0}
              isLast={index === layout.length - 1}
              onSelect={onSelect}
              onRemove={onRemove}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ComponentCanvas({ pageSlug, initialLayout }: ComponentCanvasProps) {
  const [layout, setLayout] = useState<CanvasItem[]>(initialLayout)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  const selectedItem = useMemo(
    () => layout.find((component) => component.id === selectedId) ?? null,
    [layout, selectedId]
  )

  const addComponent = (newItem: CanvasItem) => {
    setLayout((prev) => [...prev, newItem])
    setSelectedId(newItem.id)
  }

  const removeComponent = (id: string) => {
    setLayout((prev) => prev.filter((component) => component.id !== id))
    setSelectedId((current) => (current === id ? null : current))
  }

  const moveComponent = (index: number, direction: "up" | "down") => {
    setLayout((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev
      }

      const next = [...prev]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  const saveCanvas = async () => {
    setSaving(true)
    setToast(null)

    try {
      const response = await fetch("/api/components/canvas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageSlug, layout }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save")
      }

      setToast({ kind: "success", message: "Canvas saved." })
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to save",
      })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="relative flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:w-52">
          <h3 className="text-sm font-semibold text-slate-900">Blocks</h3>
          <p className="mt-1 text-xs text-slate-500">Drag these onto the page canvas.</p>
          <div className="mt-4 space-y-3 lg:max-h-[640px] lg:overflow-y-auto">
            {CANVAS_COMPONENTS.map((def) => (
              <SidebarItem key={def.type} def={def} />
            ))}
          </div>
        </aside>

        <div className="flex-1 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Home Canvas</h3>
              <p className="text-sm text-slate-500">
                Add blocks, reorder them, then save the layout for this page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void saveCanvas()}
              disabled={saving}
              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Canvas"}
            </button>
          </div>

          <div className="space-y-6 xl:grid xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-6 xl:space-y-0">
            <CanvasDropZone
              layout={layout}
              selectedId={selectedId}
              onDropItem={addComponent}
              onSelect={setSelectedId}
              onRemove={removeComponent}
              onMove={moveComponent}
            />

            {selectedItem ? (
              <PropsPanel
                componentType={selectedItem.componentType}
                currentProps={selectedItem.props}
                onUpdate={(key, value) => {
                  setLayout((prev) =>
                    prev.map((component) =>
                      component.id === selectedItem.id
                        ? { ...component, props: { ...component.props, [key]: value } }
                        : component
                    )
                  )
                }}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Select a block on the canvas to edit its props.
              </div>
            )}
          </div>
        </div>

        {toast ? (
          <div
            className={`fixed bottom-6 right-6 rounded-md px-3 py-2 text-xs font-medium shadow-sm ${
              toast.kind === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        ) : null}
      </div>
    </DndProvider>
  )
}
