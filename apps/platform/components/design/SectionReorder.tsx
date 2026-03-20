"use client"

import { useState } from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AnimatePresence, motion } from "framer-motion"

interface SectionReorderProps {
  initialOrder: string[]
}

interface UpdateSectionOrderResponse {
  success?: boolean
  error?: string
}

interface SortableItemProps {
  id: string
}

function SortableItem({ id }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  }

  const label = id.charAt(0).toUpperCase() + id.slice(1)

  return (
    <motion.div
      ref={setNodeRef}
      layout
      style={style}
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        isDragging ? "border-slate-900 shadow-md" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Drag ${label}`}
          className="cursor-grab rounded-md border border-slate-200 px-2 py-1 font-mono text-lg leading-none text-slate-500 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-500">Drag to reposition this section.</p>
        </div>
      </div>
    </motion.div>
  )
}

export default function SectionReorder({ initialOrder }: SectionReorderProps) {
  const [order, setOrder] = useState(initialOrder)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setOrder((currentOrder) => {
        const oldIndex = currentOrder.indexOf(String(active.id))
        const newIndex = currentOrder.indexOf(String(over.id))

        if (oldIndex === -1 || newIndex === -1) {
          return currentOrder
        }

        return arrayMove(currentOrder, oldIndex, newIndex)
      })
    }
  }

  const saveOrder = async () => {
    setSaving(true)
    setToast(null)

    try {
      const response = await fetch("/api/layout/reorder-sections", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "section-order",
          value: JSON.stringify(order),
        }),
      })

      const data = (await response.json()) as UpdateSectionOrderResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save section order")
      }

      setToast({ kind: "success", message: "Section order updated and rebuild triggered." })
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to save section order",
      })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <article className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {order.map((id) => (
                <SortableItem key={id} id={id} />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => void saveOrder()}
        disabled={saving}
        className="mt-5 inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Order"}
      </button>

      {toast ? (
        <div
          className={`absolute right-4 top-4 rounded-md px-3 py-2 text-xs font-medium shadow-sm ${
            toast.kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </article>
  )
}
