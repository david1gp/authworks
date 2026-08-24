import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { zitadelApiClientCreate } from "../client/zitadelApiClientCreate.js"
import {
  type ZitadelMigrationSnapshot,
  zitadelMigrationSnapshotSchema,
} from "../public/zitadelMigrationSnapshotSchema.js"

type ZitadelApiClient = ReturnType<typeof zitadelApiClientCreate>
type SkippedRecord = { readonly entity: string; readonly reason: string; readonly sourceId: string }
type MigrationCount = {
  readonly created: number
  readonly exported: number
  readonly imported: number
  readonly seen: number
  readonly skipped: number
  readonly unchanged: number
  readonly updated: number
}
type MigrationReport = {
  readonly counts: Readonly<Record<string, MigrationCount>>
  readonly skipped: readonly SkippedRecord[]
  readonly unsupported: readonly SkippedRecord[]
}

type ZitadelMigrationExportOptions = {
  readonly api: ZitadelApiClient
}

const entities = [
  "users",
  "organizations",
  "organizationMemberships",
  "projects",
  "projectRoles",
  "projectGrants",
] as const

export async function zitadelMigrationExport(
  options: ZitadelMigrationExportOptions,
): Promise<Result<{ readonly report: MigrationReport; readonly snapshot: ZitadelMigrationSnapshot }>> {
  const unsupported: SkippedRecord[] = []
  const skipped: SkippedRecord[] = []

  const organizationsResult = await options.api.organizationsList()
  if (!organizationsResult.success) return organizationsResult
  const organizations: ZitadelMigrationSnapshot["organizations"] = []
  for (const raw of organizationsResult.data) {
    const organization = organizationMap(raw)
    if (organization === undefined) {
      skipped.push({ entity: "organization", reason: "required-fields-missing", sourceId: sourceIdGet(raw) })
      continue
    }
    organizations.push(organization)
  }
  const organizationIds = organizations.map((organization) => organization.id)

  const usersResult = await options.api.usersList(organizationIds)
  if (!usersResult.success) return usersResult
  const users: ZitadelMigrationSnapshot["users"] = []
  for (const raw of usersResult.data) {
    const id = sourceIdGet(raw)
    const user = userMap(raw)
    if (user === undefined) {
      const human = objectGet(raw.human)
      const reason = human === undefined ? "machine-or-unsupported-user" : "required-fields-missing"
      unsupported.push({ entity: human === undefined ? "machineUser" : "user", reason, sourceId: id })
      continue
    }
    users.push(user)
    if (objectHasValue(raw.human, "passwordChanged"))
      unsupported.push({ entity: "userPassword", reason: "password-credentials-not-portable", sourceId: id })
    if (objectHasValue(raw, "idpLinks") || objectHasValue(raw.human, "idpLinks"))
      unsupported.push({
        entity: "federatedIdentity",
        reason: "federated-links-require-upstream-subject-mapping",
        sourceId: id,
      })
  }

  const organizationMemberships: ZitadelMigrationSnapshot["organizationMemberships"] = []
  for (const organizationId of organizationIds) {
    const membershipsResult = await options.api.organizationMembershipsList(organizationId)
    if (!membershipsResult.success) return membershipsResult
    for (const raw of membershipsResult.data) {
      const membership = organizationMembershipMap(raw, organizationId)
      if (membership === undefined) {
        skipped.push({
          entity: "organizationMembership",
          reason: "required-fields-missing",
          sourceId: sourceIdGet(raw),
        })
        continue
      }
      organizationMemberships.push(membership)
    }
  }

  const projectsResult = await options.api.projectsList(organizationIds)
  if (!projectsResult.success) return projectsResult
  const projects: ZitadelMigrationSnapshot["projects"] = []
  for (const raw of projectsResult.data) {
    const project = projectMap(raw)
    if (project === undefined) {
      skipped.push({ entity: "project", reason: "required-fields-missing", sourceId: sourceIdGet(raw) })
      continue
    }
    projects.push(project)
  }

  const projectRoles: ZitadelMigrationSnapshot["projectRoles"] = []
  for (const project of projects) {
    const rolesResult = await options.api.projectRolesList(project.id, project.organizationId)
    if (!rolesResult.success) return rolesResult
    for (const raw of rolesResult.data) {
      const role = projectRoleMap(raw, project.id)
      if (role === undefined) {
        skipped.push({ entity: "projectRole", reason: "required-fields-missing", sourceId: sourceIdGet(raw) })
        continue
      }
      projectRoles.push(role)
    }
  }

  const grantsResult = await options.api.projectGrantsList(organizationIds)
  if (!grantsResult.success) return grantsResult
  const projectGrants: ZitadelMigrationSnapshot["projectGrants"] = []
  for (const raw of grantsResult.data) {
    const grant = projectGrantMap(raw)
    if (grant === undefined) {
      skipped.push({ entity: "projectGrant", reason: "required-fields-missing", sourceId: sourceIdGet(raw) })
      continue
    }
    projectGrants.push(grant)
  }

  const candidate: ZitadelMigrationSnapshot = {
    organizations,
    organizationMemberships,
    projectGrants,
    projectRoles,
    projects,
    unsupported,
    users,
    version: 1,
  }
  const parsed = v.safeParse(zitadelMigrationSnapshotSchema, candidate)
  if (!parsed.success)
    return resultErrorCodedCreate(
      "zitadelMigrationExport",
      "The ZITADEL export contained data Authworks cannot represent.",
      "zitadel-migration.source-invalid",
    )

  const report = migrationReportCreate(
    {
      users: users.length,
      organizations: organizations.length,
      organizationMemberships: organizationMemberships.length,
      projects: projects.length,
      projectRoles: projectRoles.length,
      projectGrants: projectGrants.length,
    },
    skipped,
    unsupported,
  )
  return resultCreate({ report, snapshot: parsed.output })
}

function organizationMap(
  raw: Readonly<Record<string, unknown>>,
): ZitadelMigrationSnapshot["organizations"][number] | undefined {
  const id = stringGet(raw.id)
  const name = stringGet(raw.name)
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate)
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate) ?? createdAt
  const status = organizationStatusMap(raw.state)
  if (
    id === undefined ||
    name === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    status === undefined
  )
    return undefined
  return { createdAt, id, name, status, updatedAt }
}

function userMap(raw: Readonly<Record<string, unknown>>): ZitadelMigrationSnapshot["users"][number] | undefined {
  const human = objectGet(raw.human)
  const emailRecord = objectGet(human?.email)
  const profile = objectGet(human?.profile)
  const id = stringGet(raw.id)
  const userName = stringGet(raw.userName)
  const email = stringGet(emailRecord?.email)
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate)
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate) ?? createdAt
  const state = userStateMap(raw.state)
  if (
    human === undefined ||
    id === undefined ||
    userName === undefined ||
    email === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    state === undefined
  )
    return undefined
  const emailVerified = emailRecord?.isEmailVerified === true
  return {
    createdAt,
    deletedAt: state === "deleted" ? updatedAt : null,
    email,
    emailVerified,
    emailVerifiedAt: emailVerified ? updatedAt : null,
    id,
    profile: {
      displayName: nullableStringGet(profile?.displayName),
      firstName: nullableStringGet(profile?.firstName),
      gender: nullableStringGet(profile?.gender),
      lastName: nullableStringGet(profile?.lastName),
      nickName: nullableStringGet(profile?.nickName),
      preferredLanguage: nullableStringGet(profile?.preferredLanguage),
    },
    state,
    updatedAt,
    userName,
  }
}

function organizationMembershipMap(
  raw: Readonly<Record<string, unknown>>,
  organizationId: string,
): ZitadelMigrationSnapshot["organizationMemberships"][number] | undefined {
  const userId = stringGet(raw.userId)
  const roles = stringArrayGet(raw.roles)
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate)
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate) ?? createdAt
  if (
    userId === undefined ||
    roles === undefined ||
    roles.length === 0 ||
    createdAt === undefined ||
    updatedAt === undefined
  )
    return undefined
  return {
    createdAt,
    id: stringGet(raw.id) ?? `zitadel-membership-${organizationId}-${userId}`,
    organizationId,
    roles,
    updatedAt,
    userId,
  }
}

function projectMap(raw: Readonly<Record<string, unknown>>): ZitadelMigrationSnapshot["projects"][number] | undefined {
  const details = objectGet(raw.details)
  const id = stringGet(raw.id)
  const organizationId = stringGet(details?.resourceOwner) ?? stringGet(raw.organizationId)
  const name = stringGet(raw.name)
  const createdAt = timestampGet(details?.creationDate)
  const updatedAt = timestampGet(details?.changeDate) ?? createdAt
  const status = projectStatusMap(raw.state)
  if (
    id === undefined ||
    organizationId === undefined ||
    name === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    status === undefined
  )
    return undefined
  return {
    authorizationRequired: raw.projectRoleCheck === true || raw.projectRoleAssertion === true,
    createdAt,
    id,
    name,
    organizationId,
    projectAccessRequired: raw.hasProjectCheck === true,
    status,
    updatedAt,
  }
}

function projectRoleMap(
  raw: Readonly<Record<string, unknown>>,
  projectId: string,
): ZitadelMigrationSnapshot["projectRoles"][number] | undefined {
  const details = objectGet(raw.details)
  const key = stringGet(raw.key)
  const displayName = stringGet(raw.displayName) ?? key
  const createdAt = timestampGet(details?.creationDate)
  const updatedAt = timestampGet(details?.changeDate) ?? createdAt
  if (key === undefined || displayName === undefined || createdAt === undefined || updatedAt === undefined)
    return undefined
  return {
    createdAt,
    displayName,
    group: nullableStringGet(raw.group),
    id: stringGet(raw.id) ?? `zitadel-role-${projectId}-${key}`,
    key,
    projectId,
    updatedAt,
  }
}

function projectGrantMap(
  raw: Readonly<Record<string, unknown>>,
): ZitadelMigrationSnapshot["projectGrants"][number] | undefined {
  const details = objectGet(raw.details)
  const id = stringGet(raw.grantId) ?? stringGet(raw.id)
  const projectId = stringGet(raw.projectId)
  const organizationId = stringGet(raw.projectOwnerId) ?? stringGet(raw.organizationId)
  const grantedOrganizationId = stringGet(raw.grantedOrgId) ?? stringGet(raw.grantedOrganizationId)
  const rawRoleKeys = raw.grantedRoleKeys ?? raw.roleKeys
  const roleKeys = rawRoleKeys === undefined ? [] : stringArrayGet(rawRoleKeys)
  const createdAt = timestampGet(details?.creationDate)
  const updatedAt = timestampGet(details?.changeDate) ?? createdAt
  const status = projectGrantStatusMap(raw.state)
  if (
    id === undefined ||
    projectId === undefined ||
    organizationId === undefined ||
    grantedOrganizationId === undefined ||
    roleKeys === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    status === undefined
  )
    return undefined
  return {
    createdAt,
    grantedOrganizationId,
    id,
    organizationId,
    projectId,
    roleKeys,
    status,
    updatedAt,
  }
}

function organizationStatusMap(value: unknown): "active" | "inactive" | "removed" | undefined {
  if (value === "ORG_STATE_ACTIVE") return "active"
  if (value === "ORG_STATE_INACTIVE") return "inactive"
  if (value === "ORG_STATE_REMOVED") return "removed"
  return value === "active" || value === "inactive" || value === "removed" ? value : undefined
}

function userStateMap(
  value: unknown,
): "initial" | "active" | "inactive" | "locked" | "suspended" | "deleted" | undefined {
  if (value === "USER_STATE_ACTIVE") return "active"
  if (value === "USER_STATE_INACTIVE") return "inactive"
  if (value === "USER_STATE_DELETED") return "deleted"
  if (value === "USER_STATE_LOCKED") return "locked"
  if (value === "USER_STATE_SUSPEND") return "suspended"
  if (value === "USER_STATE_INITIAL") return "initial"
  return value === "initial" ||
    value === "active" ||
    value === "inactive" ||
    value === "locked" ||
    value === "suspended" ||
    value === "deleted"
    ? value
    : undefined
}

function projectStatusMap(value: unknown): "active" | "inactive" | "removed" | undefined {
  if (value === "PROJECT_STATE_ACTIVE") return "active"
  if (value === "PROJECT_STATE_INACTIVE") return "inactive"
  return value === "active" || value === "inactive" || value === "removed" ? value : undefined
}

function projectGrantStatusMap(value: unknown): "active" | "inactive" | "removed" | undefined {
  if (value === "PROJECT_GRANT_STATE_ACTIVE") return "active"
  if (value === "PROJECT_GRANT_STATE_INACTIVE") return "inactive"
  return value === "active" || value === "inactive" || value === "removed" ? value : undefined
}

function migrationReportCreate(
  exported: Readonly<Record<string, number>>,
  skipped: readonly SkippedRecord[],
  unsupported: readonly SkippedRecord[],
): MigrationReport {
  const counts: Record<string, MigrationCount> = {}
  for (const entity of entities) {
    const count = exported[entity] ?? 0
    counts[entity] = { created: 0, exported: count, imported: 0, seen: count, skipped: 0, unchanged: 0, updated: 0 }
  }
  const skippedByEntity = new Map<string, number>()
  for (const record of [...skipped, ...unsupported])
    skippedByEntity.set(record.entity, (skippedByEntity.get(record.entity) ?? 0) + 1)
  for (const [entity, count] of skippedByEntity) {
    const key = entity.endsWith("s") ? entity : `${entity}s`
    const current = counts[key]
    if (current !== undefined)
      counts[key] = { ...current, skipped: current.skipped + count, seen: current.seen + count }
  }
  return { counts, skipped, unsupported }
}

function objectGet(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  return value as Readonly<Record<string, unknown>>
}

function objectHasValue(object: unknown, key: string): boolean {
  const record = objectGet(object)
  return record !== undefined && record[key] !== undefined && record[key] !== null
}

function stringGet(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function nullableStringGet(value: unknown): string | null {
  return stringGet(value) ?? null
}

function stringArrayGet(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result: string[] = []
  for (const item of value) {
    const string = stringGet(item)
    if (string === undefined) return undefined
    if (!result.includes(string)) result.push(string)
  }
  return result
}

function timestampGet(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === "string") {
    const timestamp = Date.parse(value)
    if (Number.isSafeInteger(timestamp) && timestamp >= 0) return timestamp
  }
  const record = objectGet(value)
  if (record !== undefined) {
    const seconds = typeof record.seconds === "string" ? Number(record.seconds) : record.seconds
    const nanos = typeof record.nanos === "number" ? record.nanos : 0
    if (typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds >= 0)
      return seconds * 1000 + Math.floor(nanos / 1_000_000)
  }
  return undefined
}

function sourceIdGet(raw: Readonly<Record<string, unknown>>): string {
  return stringGet(raw.id) ?? stringGet(raw.userId) ?? stringGet(raw.grantId) ?? "unknown"
}
