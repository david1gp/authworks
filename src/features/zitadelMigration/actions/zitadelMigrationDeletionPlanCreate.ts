import { normalizeSourceInstance } from "../persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import type { ZitadelMigrationSourceRecord } from "../persistence/zitadelMigrationSourceRecordTable.js"
import type { ZitadelMigrationSnapshot } from "../public/zitadelMigrationSnapshotSchema.js"

export type DeletionPlanEntry = {
  readonly destinationId: string
  readonly entityType: string
  readonly reason: "absent-from-complete-collection"
  readonly sourceId: string
}
type DeletionPlanOmission = {
  readonly entityType: string
  readonly reason: string
  readonly sourceId: string
}
export type ZitadelMigrationDeletionPlan = {
  readonly entries: readonly DeletionPlanEntry[]
  readonly omissions: readonly DeletionPlanOmission[]
}

export function zitadelMigrationOidcClientSourceId(applicationSourceId: string): string {
  return `oidc-client:${applicationSourceId}`
}

const order = [
  "externalIdentityLink",
  "identityProvider",
  "machineUser",
  "projectGrant",
  "projectRole",
  "oidcClient",
  "projectApplication",
  "project",
  "organizationMembership",
  "domain",
  "loginPolicy",
  "user",
  "organization",
] as const

const collectionByEntity: Readonly<Record<string, keyof ZitadelMigrationSnapshot["completeness"]>> = {
  externalIdentityLink: "externalIdentityLinks",
  identityProvider: "identityProviders",
  machineUser: "machineUsers",
  projectGrant: "projectGrants",
  projectRole: "projectRoles",
  projectApplication: "oidcApplications",
  oidcClient: "oidcApplications",
  project: "projects",
  organizationMembership: "organizationMemberships",
  domain: "domains",
  loginPolicy: "loginPolicies",
  user: "users",
  organization: "organizations",
}

type DeletionPlanOptions = {
  readonly realmId?: string
  readonly mappings: readonly ZitadelMigrationSourceRecord[]
  readonly skipped?: readonly { readonly entity: string; readonly reason: string; readonly sourceId: string }[]
  readonly includeUsersAndOrganizations?: boolean
}

export function zitadelMigrationDeletionPlanCreate(
  snapshot: ZitadelMigrationSnapshot,
  options: DeletionPlanOptions,
): ZitadelMigrationDeletionPlan {
  const entries: DeletionPlanEntry[] = []
  const omissions: DeletionPlanOmission[] = []
  const skipped = new Map(
    (options.skipped ?? snapshot.unsupported)
      .filter(
        (item) =>
          !(
            item.entity === "oidcApplication" &&
            ["unsupported-application-protocol", "unsupported-oidc-auth-method"].includes(item.reason)
          ),
      )
      .map((item) => [`${item.entity}:${item.sourceId}`, item.reason]),
  )
  const mappings = options.mappings.filter(
    (mapping) =>
      mapping.realmId !== "" &&
      (options.realmId === undefined || mapping.realmId === options.realmId) &&
      normalizeSourceInstance(mapping.sourceInstance) === normalizeSourceInstance(snapshot.sourceInstance),
  )
  const sourceIds = new Map<string, Set<string>>()
  for (const mapping of mappings) {
    const collection = collectionByEntity[mapping.entityType]
    if (collection === undefined) continue
    if (!sourceIds.has(mapping.entityType)) sourceIds.set(mapping.entityType, new Set())
    sourceIds.get(mapping.entityType)?.add(mapping.sourceId)
  }
  for (const entityType of order) {
    const collection = collectionByEntity[entityType]
    if (collection === undefined) continue
    const complete = snapshot.completeness[collection].complete
    for (const mapping of mappings) {
      if (mapping.entityType !== entityType) continue
      if (!complete) {
        omissions.push({ entityType, reason: "collection-incomplete", sourceId: mapping.sourceId })
        continue
      }
      const seen = (snapshot[collection] as readonly Record<string, unknown>[]).some(
        (item) => sourceIdFor(entityType, collection, item) === mapping.sourceId,
      )
      const parent = unresolvedParent(snapshot, collection, mapping.sourceId, sourceIds)
      if (parent !== null) {
        omissions.push({ entityType, reason: `unresolved-parent:${parent}`, sourceId: mapping.sourceId })
        continue
      }
      if (seen) continue
      const skippedReason =
        skipped.get(`${collection}:${mapping.sourceId}`) ?? skipped.get(`${entityType}:${mapping.sourceId}`)
      if (skippedReason !== undefined) {
        omissions.push({ entityType, reason: `source-record-${skippedReason}`, sourceId: mapping.sourceId })
        continue
      }
      entries.push({
        destinationId: mapping.destinationId,
        entityType,
        reason: "absent-from-complete-collection",
        sourceId: mapping.sourceId,
      })
    }
  }
  for (const mapping of options.mappings) {
    if (mapping.sourceInstance.trim() === "")
      omissions.push({ entityType: mapping.entityType, reason: "missing-source-instance", sourceId: mapping.sourceId })
    else if (normalizeSourceInstance(mapping.sourceInstance) !== normalizeSourceInstance(snapshot.sourceInstance))
      omissions.push({ entityType: mapping.entityType, reason: "other-source-instance", sourceId: mapping.sourceId })
  }
  if (!options.includeUsersAndOrganizations) {
    for (const entityType of ["user", "organization"] as const) {
      for (const mapping of mappings.filter((item) => item.entityType === entityType))
        omissions.push({ entityType, reason: "users-and-organizations-not-planned", sourceId: mapping.sourceId })
    }
    return {
      entries: entries.filter((entry) => entry.entityType !== "user" && entry.entityType !== "organization"),
      omissions,
    }
  }
  return { entries, omissions }
}

function sourceIdFor(entityType: string, collection: string, item: Record<string, unknown>): string {
  if (entityType === "oidcClient" && typeof item.sourceId === "string")
    return zitadelMigrationOidcClientSourceId(item.sourceId)
  return typeof item.sourceId === "string"
    ? item.sourceId
    : typeof item.id === "string"
      ? item.id
      : `${collection}:unknown`
}

function unresolvedParent(
  snapshot: ZitadelMigrationSnapshot,
  collection: keyof ZitadelMigrationSnapshot["completeness"],
  sourceId: string,
  sourceIds: Map<string, Set<string>>,
): string | null {
  const item = (snapshot[collection] as readonly Record<string, unknown>[]).find(
    (value) =>
      sourceIdFor(collection === "oidcApplications" ? "projectApplication" : collection, collection, value) ===
      sourceId,
  )
  const parent =
    collection === "projectRoles" || collection === "projectGrants" || collection === "oidcApplications"
      ? "project"
      : collection === "organizationMemberships" || collection === "domains" || collection === "loginPolicies"
        ? "organization"
        : collection === "externalIdentityLinks"
          ? "identityProvider"
          : null
  if (parent === null) return null
  const parentCollection = collectionByEntity[parent]
  if (parentCollection !== undefined && !snapshot.completeness[parentCollection].complete) return parent
  if (item === undefined) return sourceIds.has(parent) ? null : parent
  const parentSourceId =
    typeof item.projectId === "string" || typeof item.organizationId === "string"
      ? String(item.projectId ?? item.organizationId)
      : null
  return parentSourceId !== null && ![...(sourceIds.get(parent) ?? [])].includes(parentSourceId) ? parent : null
}
