import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { organizationRolesEncode } from "../../organizations/domain/organizationRolesEncode.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { OrganizationRow } from "../../organizations/persistence/organizationTable.js"
import { projectRoleKeysEncode } from "../../projects/domain/projectRoleKeysEncode.js"
import { projectRepositoryCreate } from "../../projects/persistence/projectRepositoryCreate.js"
import { realmRepositoryCreate } from "../../realms/persistence/realmRepositoryCreate.js"
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { userNameNormalize } from "../../users/domain/userNameNormalize.js"
import type { UserRecord } from "../../users/persistence/userRepositoryCreate.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import { zitadelMigrationOrganizationRolesMap } from "../domain/zitadelMigrationOrganizationRolesMap.js"
import {
  type ZitadelMigrationSnapshot,
  zitadelMigrationSnapshotSchema,
} from "../public/zitadelMigrationSnapshotSchema.js"

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
type ImportState = {
  readonly counts: Record<string, MigrationCount>
  readonly organizationIds: Map<string, string>
  readonly skipped: SkippedRecord[]
  readonly unsupported: SkippedRecord[]
}
type ZitadelMigrationImportOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly snapshot: unknown
}

const entities = [
  "users",
  "organizations",
  "organizationMemberships",
  "projects",
  "projectRoles",
  "projectGrants",
] as const

export function zitadelMigrationImport(options: ZitadelMigrationImportOptions): Result<MigrationReport> {
  const parsed = v.safeParse(zitadelMigrationSnapshotSchema, options.snapshot)
  if (!parsed.success)
    return resultErrorCodedCreate(
      "zitadelMigrationImport",
      "The migration snapshot is invalid.",
      "zitadel-migration.snapshot-invalid",
    )
  const state = importStateCreate(parsed.output)
  return storageTransactionRun(options.database, (transaction) => {
    const realm = realmRepositoryCreate(transaction).realmGet(options.realmId)
    if (!realm.success) return realm
    if (realm.data === null || realm.data.status !== "active")
      return resultErrorCodedCreate(
        "zitadelMigrationImport",
        "The target Authworks realm was not found or is not active.",
        "zitadel-migration.realm-invalid",
      )

    const users = userRepositoryCreate(transaction)
    for (const input of parsed.output.users) {
      const result = importUser(users, options.realmId, input, state)
      if (!result.success) return result
    }

    const organizations = organizationRepositoryCreate(transaction)
    for (const input of parsed.output.organizations) {
      const result = importOrganization(organizations, options.realmId, input, state)
      if (!result.success) return result
    }

    for (const input of parsed.output.organizationMemberships) {
      const result = importOrganizationMembership(organizations, users, options.realmId, input, state)
      if (!result.success) return result
    }

    const projects = projectRepositoryCreate(transaction)
    for (const input of parsed.output.projects) {
      const result = importProject(projects, organizations, options.realmId, input, state)
      if (!result.success) return result
    }

    for (const input of parsed.output.projectRoles) {
      const result = importProjectRole(projects, options.realmId, input, state)
      if (!result.success) return result
    }

    for (const input of parsed.output.projectGrants) {
      const result = importProjectGrant(projects, organizations, options.realmId, input, state)
      if (!result.success) return result
    }

    return resultCreate(migrationReportCreate(state))
  })
}

function importUser(
  repository: ReturnType<typeof userRepositoryCreate>,
  realmId: string,
  input: ZitadelMigrationSnapshot["users"][number],
  state: ImportState,
): Result<void> {
  const email = userEmailNormalize(input.email)
  if (!email.success) return skipResult(state, "users", input.id, "invalid-email")
  const userName = userNameNormalize(input.userName)
  if (!userName.success) return skipResult(state, "users", input.id, "invalid-name")
  const current = repository.userGet(realmId, input.id)
  if (!current.success) return current
  const natural = repository.userList(realmId)
  if (!natural.success) return natural
  const naturalMatch = natural.data.find(
    (user) => user.id !== input.id && (user.email === email.data || user.userName === userName.data),
  )
  if (naturalMatch !== undefined) return skipResult(state, "users", input.id, "stable-id-conflict")

  const source = {
    createdAt: input.createdAt,
    deletedAt: input.deletedAt,
    email: email.data,
    emailVerifiedAt: input.emailVerified ? (input.emailVerifiedAt ?? input.updatedAt) : null,
    id: input.id,
    realmId,
    state: input.state,
    updatedAt: input.updatedAt,
    userName: userName.data,
    version: current.data?.version ?? 1,
  }
  const profile = {
    displayName: input.profile.displayName,
    firstName: input.profile.firstName,
    gender: input.profile.gender,
    lastName: input.profile.lastName,
    nickName: input.profile.nickName,
    preferredLanguage: input.profile.preferredLanguage,
    realmId,
    updatedAt: input.updatedAt,
    userId: input.id,
  }
  if (current.data === null) {
    const created = repository.userCreate(source, profile)
    if (!created.success) return created
    countCreated(state, "users")
    return resultCreate(undefined)
  }
  if (userEqual(current.data, source, profile)) {
    countUnchanged(state, "users")
    return resultCreate(undefined)
  }
  const updated = repository.userUpdate(realmId, input.id, { ...source, version: current.data.version + 1 })
  if (!updated.success) return updated
  const profileUpdated = repository.userProfileUpdate(realmId, input.id, profile)
  if (!profileUpdated.success) return profileUpdated
  countUpdated(state, "users")
  return resultCreate(undefined)
}

function importOrganization(
  repository: ReturnType<typeof organizationRepositoryCreate>,
  realmId: string,
  input: ZitadelMigrationSnapshot["organizations"][number],
  state: ImportState,
): Result<void> {
  const currentById = repository.organizationGet(input.id)
  if (!currentById.success) return currentById
  if (currentById.data !== null && currentById.data.realmId !== realmId)
    return skipResult(state, "organizations", input.id, "realm-conflict")
  const natural = repository.organizationList(realmId)
  if (!natural.success) return natural
  const naturalMatch = natural.data.find(
    (organization) => organization.id !== input.id && organization.name === input.name,
  )
  const current = currentById.data ?? naturalMatch ?? null
  state.organizationIds.set(input.id, current?.id ?? input.id)
  const source = {
    createdAt: input.createdAt,
    id: current?.id ?? input.id,
    name: input.name,
    realmId,
    status: input.status,
    updatedAt: input.updatedAt,
    version: current?.version ?? 1,
  }
  if (current === null) {
    const created = repository.organizationCreate(source)
    if (!created.success) return created
    countCreated(state, "organizations")
    return resultCreate(undefined)
  }
  if (organizationEqual(current, source)) {
    countUnchanged(state, "organizations")
    return resultCreate(undefined)
  }
  const updated = repository.organizationUpdate(current.id, { ...source, version: current.version + 1 })
  if (!updated.success) return updated
  countUpdated(state, "organizations")
  return resultCreate(undefined)
}

function importOrganizationMembership(
  repository: ReturnType<typeof organizationRepositoryCreate>,
  userRepository: ReturnType<typeof userRepositoryCreate>,
  realmId: string,
  input: ZitadelMigrationSnapshot["organizationMemberships"][number],
  state: ImportState,
): Result<void> {
  const organizationId = state.organizationIds.get(input.organizationId) ?? input.organizationId
  const organization = repository.organizationGet(organizationId)
  if (!organization.success) return organization
  if (organization.data === null || organization.data.realmId !== realmId)
    return skipResult(state, "organizationMemberships", input.id, "organization-not-found")
  const userExists = repositoryMembershipUserExists(userRepository, realmId, input.userId)
  if (!userExists.success) return userExists
  if (!userExists.data) return skipResult(state, "organizationMemberships", input.id, "user-not-found")
  const mapped = zitadelMigrationOrganizationRolesMap(input.roles)
  for (const role of mapped.unsupported)
    state.unsupported.push({
      entity: "organizationRole",
      reason: "role-not-representable",
      sourceId: `${input.id}:${role}`,
    })
  if (mapped.mapped.length === 0) return skipResult(state, "organizationMemberships", input.id, "no-supported-roles")
  const roles = organizationRolesEncode(mapped.mapped)
  if (!roles.success) return roles
  const byId = repository.organizationMembershipGet(input.id)
  if (!byId.success) return byId
  const byRelationship = repository.organizationMembershipGetByOrganizationUser(organizationId, input.userId)
  if (!byRelationship.success) return byRelationship
  const current = byId.data ?? byRelationship.data
  if (
    current !== null &&
    (current.realmId !== realmId || current.organizationId !== organizationId || current.userId !== input.userId)
  )
    return skipResult(state, "organizationMemberships", input.id, "stable-id-conflict")
  const source = {
    createdAt: input.createdAt,
    id: current?.id ?? input.id,
    organizationId,
    realmId,
    roles: roles.data,
    updatedAt: input.updatedAt,
    userId: input.userId,
    version: current?.version ?? 1,
  }
  if (current === null) {
    const created = repository.organizationMembershipCreate(source)
    if (!created.success) return created
    countCreated(state, "organizationMemberships")
    return resultCreate(undefined)
  }
  if (current.roles === source.roles && current.updatedAt === source.updatedAt) {
    countUnchanged(state, "organizationMemberships")
    return resultCreate(undefined)
  }
  const updated = repository.organizationMembershipUpdate(current.id, {
    roles: source.roles,
    updatedAt: source.updatedAt,
    version: current.version + 1,
  })
  if (!updated.success) return updated
  countUpdated(state, "organizationMemberships")
  return resultCreate(undefined)
}

function importProject(
  repository: ReturnType<typeof projectRepositoryCreate>,
  organizationRepository: ReturnType<typeof organizationRepositoryCreate>,
  realmId: string,
  input: ZitadelMigrationSnapshot["projects"][number],
  state: ImportState,
): Result<void> {
  const organizationId = state.organizationIds.get(input.organizationId) ?? input.organizationId
  const organization = organizationRepository.organizationGet(organizationId)
  if (!organization.success) return organization
  if (organization.data === null || organization.data.realmId !== realmId)
    return skipResult(state, "projects", input.id, "organization-not-found")
  const current = repository.projectGet(input.id)
  if (!current.success) return current
  if (current.data !== null && (current.data.realmId !== realmId || current.data.organizationId !== organizationId))
    return skipResult(state, "projects", input.id, "stable-id-conflict")
  const projectList = repository.projectList(realmId)
  if (!projectList.success) return projectList
  const naturalMatch = projectList.data.find(
    (project) => project.id !== input.id && project.organizationId === organizationId && project.name === input.name,
  )
  if (naturalMatch !== undefined) return skipResult(state, "projects", input.id, "stable-id-conflict")
  const source = {
    authorizationRequired: input.authorizationRequired ? 1 : 0,
    createdAt: input.createdAt,
    id: input.id,
    name: input.name,
    organizationId,
    projectAccessRequired: input.projectAccessRequired ? 1 : 0,
    realmId,
    status: input.status,
    updatedAt: input.updatedAt,
    version: current.data?.version ?? 1,
  }
  if (current.data === null) {
    const created = repository.projectCreate(source)
    if (!created.success) return created
    countCreated(state, "projects")
    return resultCreate(undefined)
  }
  if (
    current.data.authorizationRequired === source.authorizationRequired &&
    current.data.name === source.name &&
    current.data.projectAccessRequired === source.projectAccessRequired &&
    current.data.status === source.status &&
    current.data.updatedAt === source.updatedAt
  ) {
    countUnchanged(state, "projects")
    return resultCreate(undefined)
  }
  const updated = repository.projectUpdate(input.id, { ...source, version: current.data.version + 1 })
  if (!updated.success) return updated
  countUpdated(state, "projects")
  return resultCreate(undefined)
}

function importProjectRole(
  repository: ReturnType<typeof projectRepositoryCreate>,
  realmId: string,
  input: ZitadelMigrationSnapshot["projectRoles"][number],
  state: ImportState,
): Result<void> {
  const project = repository.projectGet(input.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== realmId)
    return skipResult(state, "projectRoles", input.id, "project-not-found")
  const byId = repository.projectRoleGet(input.id)
  if (!byId.success) return byId
  const byKey = repository.projectRoleGetByProjectKey(input.projectId, input.key)
  if (!byKey.success) return byKey
  const current = byId.data ?? byKey.data
  if (current !== null && (current.projectId !== input.projectId || current.key !== input.key))
    return skipResult(state, "projectRoles", input.id, "stable-id-conflict")
  const source = {
    createdAt: input.createdAt,
    displayName: input.displayName,
    group: input.group,
    id: current?.id ?? input.id,
    key: input.key,
    projectId: input.projectId,
    realmId,
    updatedAt: input.updatedAt,
    version: current?.version ?? 1,
  }
  if (current === null) {
    const created = repository.projectRoleCreate(source)
    if (!created.success) return created
    countCreated(state, "projectRoles")
    return resultCreate(undefined)
  }
  if (
    current.displayName === source.displayName &&
    current.group === source.group &&
    current.updatedAt === source.updatedAt
  ) {
    countUnchanged(state, "projectRoles")
    return resultCreate(undefined)
  }
  const updated = repository.projectRoleUpdate(current.id, {
    displayName: source.displayName,
    group: source.group,
    updatedAt: source.updatedAt,
    version: current.version + 1,
  })
  if (!updated.success) return updated
  countUpdated(state, "projectRoles")
  return resultCreate(undefined)
}

function importProjectGrant(
  repository: ReturnType<typeof projectRepositoryCreate>,
  organizationRepository: ReturnType<typeof organizationRepositoryCreate>,
  realmId: string,
  input: ZitadelMigrationSnapshot["projectGrants"][number],
  state: ImportState,
): Result<void> {
  const organizationId = state.organizationIds.get(input.organizationId) ?? input.organizationId
  const grantedOrganizationId = state.organizationIds.get(input.grantedOrganizationId) ?? input.grantedOrganizationId
  const project = repository.projectGet(input.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== realmId)
    return skipResult(state, "projectGrants", input.id, "project-not-found")
  if (project.data.organizationId !== organizationId)
    return skipResult(state, "projectGrants", input.id, "project-owner-mismatch")
  if (organizationId === grantedOrganizationId)
    return skipResult(state, "projectGrants", input.id, "owner-grant-not-supported")
  const roles = repository.projectRoleList(input.projectId)
  if (!roles.success) return roles
  if (input.roleKeys.some((key) => !roles.data.some((role) => role.key === key)))
    return skipResult(state, "projectGrants", input.id, "project-role-not-found")
  const encoded = projectRoleKeysEncode(input.roleKeys)
  if (!encoded.success) return encoded
  const grantedOrganization = organizationRepository.organizationGet(grantedOrganizationId)
  if (!grantedOrganization.success) return grantedOrganization
  if (grantedOrganization.data === null || grantedOrganization.data.realmId !== realmId)
    return skipResult(state, "projectGrants", input.id, "granted-organization-not-found")
  const byId = repository.projectGrantGet(input.id)
  if (!byId.success) return byId
  const byRelationship = repository.projectGrantGetByProjectOrganization(input.projectId, grantedOrganizationId)
  if (!byRelationship.success) return byRelationship
  const current = byId.data ?? byRelationship.data
  if (
    current !== null &&
    (current.projectId !== input.projectId || current.grantedOrganizationId !== grantedOrganizationId)
  )
    return skipResult(state, "projectGrants", input.id, "stable-id-conflict")
  const source = {
    createdAt: input.createdAt,
    grantedOrganizationId,
    id: current?.id ?? input.id,
    organizationId,
    projectId: input.projectId,
    realmId,
    roleKeys: encoded.data,
    status: input.status,
    updatedAt: input.updatedAt,
    version: current?.version ?? 1,
  }
  if (current === null) {
    const created = repository.projectGrantCreate(source)
    if (!created.success) return created
    countCreated(state, "projectGrants")
    return resultCreate(undefined)
  }
  if (
    current.roleKeys === source.roleKeys &&
    current.status === source.status &&
    current.updatedAt === source.updatedAt
  ) {
    countUnchanged(state, "projectGrants")
    return resultCreate(undefined)
  }
  const updated = repository.projectGrantUpdate(current.id, {
    roleKeys: source.roleKeys,
    status: source.status,
    updatedAt: source.updatedAt,
    version: current.version + 1,
  })
  if (!updated.success) return updated
  countUpdated(state, "projectGrants")
  return resultCreate(undefined)
}

function repositoryMembershipUserExists(
  repository: ReturnType<typeof userRepositoryCreate>,
  realmId: string,
  userId: string,
): Result<boolean> {
  const user = repository.userGet(realmId, userId)
  if (!user.success) return user
  return resultCreate(user.data !== null)
}

function userEqual(
  current: UserRecord,
  source: Readonly<{
    createdAt: number
    deletedAt: number | null
    email: string
    emailVerifiedAt: number | null
    state: string
    updatedAt: number
    userName: string
  }>,
  profile: Readonly<{
    displayName: string | null
    firstName: string | null
    gender: string | null
    lastName: string | null
    nickName: string | null
    preferredLanguage: string | null
  }>,
): boolean {
  return (
    current.createdAt === source.createdAt &&
    current.deletedAt === source.deletedAt &&
    current.email === source.email &&
    current.emailVerifiedAt === source.emailVerifiedAt &&
    current.state === source.state &&
    current.updatedAt === source.updatedAt &&
    current.userName === source.userName &&
    current.profile.displayName === profile.displayName &&
    current.profile.firstName === profile.firstName &&
    current.profile.gender === profile.gender &&
    current.profile.lastName === profile.lastName &&
    current.profile.nickName === profile.nickName &&
    current.profile.preferredLanguage === profile.preferredLanguage
  )
}

function organizationEqual(
  current: OrganizationRow,
  source: Readonly<{ createdAt: number; name: string; status: string; updatedAt: number }>,
): boolean {
  return (
    current.createdAt === source.createdAt &&
    current.name === source.name &&
    current.status === source.status &&
    current.updatedAt === source.updatedAt
  )
}

function importStateCreate(snapshot: ZitadelMigrationSnapshot): ImportState {
  const counts: Record<string, MigrationCount> = {}
  for (const entity of entities) {
    const seen = snapshot[entity].length
    counts[entity] = { created: 0, exported: 0, imported: 0, seen, skipped: 0, unchanged: 0, updated: 0 }
  }
  return { counts, organizationIds: new Map(), skipped: [], unsupported: [...snapshot.unsupported] }
}

function migrationReportCreate(state: ImportState): MigrationReport {
  return { counts: state.counts, skipped: state.skipped, unsupported: state.unsupported }
}

function skipResult(state: ImportState, entity: string, sourceId: string, reason: string): Result<void> {
  state.skipped.push({ entity, reason, sourceId })
  const count = state.counts[entity]
  if (count !== undefined) state.counts[entity] = { ...count, skipped: count.skipped + 1 }
  return resultCreate(undefined)
}

function countCreated(state: ImportState, entity: string) {
  const count = state.counts[entity]
  if (count !== undefined) state.counts[entity] = { ...count, created: count.created + 1, imported: count.imported + 1 }
}

function countUpdated(state: ImportState, entity: string) {
  const count = state.counts[entity]
  if (count !== undefined) state.counts[entity] = { ...count, imported: count.imported + 1, updated: count.updated + 1 }
}

function countUnchanged(state: ImportState, entity: string) {
  const count = state.counts[entity]
  if (count !== undefined)
    state.counts[entity] = { ...count, imported: count.imported + 1, unchanged: count.unchanged + 1 }
}
