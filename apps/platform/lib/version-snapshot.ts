import { prisma } from "@/lib/prisma"
import { ChangeSource } from "@prisma/client"

interface CreateSnapshotOptions {
  siteId: string
  pageSlug: string
  fieldKey: string
  previousValue: string
  newValue: string
  changedBy: string
  source: ChangeSource
  maxVersions: number // 10 for Tier1/Tier2, 30 for Tier3
}

export async function createVersionSnapshot(options: CreateSnapshotOptions): Promise<void> {
  const {
    siteId,
    pageSlug,
    fieldKey,
    previousValue,
    newValue,
    changedBy,
    source,
    maxVersions,
  } = options

  const contentField = await prisma.contentField.upsert({
    where: {
      siteId_page_field: {
        siteId,
        page: pageSlug,
        field: fieldKey,
      },
    },
    create: {
      siteId,
      page: pageSlug,
      field: fieldKey,
      value: previousValue,
    },
    update: {
      value: newValue,
    },
    select: { id: true },
  })

  // Create the new snapshot
  await prisma.versionSnapshot.create({
    data: {
      siteId,
      pageSlug,
      fieldKey,
      contentFieldId: contentField.id,
      page: pageSlug,
      field: fieldKey,
      previousValue,
      newValue,
      changedBy,
      source,
    },
  })

  // Enforce version limit — delete oldest snapshots beyond the tier limit
  const allSnapshots = await prisma.versionSnapshot.findMany({
    where: { siteId, pageSlug, fieldKey },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (allSnapshots.length > maxVersions) {
    const toDelete = allSnapshots.slice(maxVersions).map((s) => s.id)
    await prisma.versionSnapshot.deleteMany({
      where: { id: { in: toDelete } },
    })
  }
}

export function getMaxVersions(tier: string): number {
  return tier === "TIER3" ? 30 : 10
}
