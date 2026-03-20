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
import { RiDraggable } from "react-icons/ri"
import { toast } from "sonner"

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
      className={`rounded-xl border p-4 shadow-[var(--shadow-sm)] ${
        isDragging
          ? "border-[var(--border-accent)] bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Drag ${label}`}
          className="flex h-10 w-10 cursor-grab items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <RiDraggable size={18} />
        </button>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Drag to reposition this section.</p>
        </div>
      </div>
    </motion.div>
  )
}

export default function SectionReorder({ initialOrder }: SectionReorderProps) {
  const [order, setOrder] = useState(initialOrder)
  const [saving, setSaving] = useState(false)

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

      toast.success("Section order updated and rebuild triggered.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save section order")
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="rw-card p-5">
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
        className="rw-btn rw-btn-primary mt-5"
      >
        {saving ? "Saving..." : "Save Order"}
      </button>
    </article>
  )
}
