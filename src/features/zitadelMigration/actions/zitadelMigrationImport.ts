import { createHash, randomUUID } from "node:crypto"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { externalIdentityProviderScopesValidate } from "../../externalIdentities/domain/externalIdentityProviderScopesValidate.js"
import { externalIdentityRepositoryCreate } from "../../externalIdentities/persistence/externalIdentityRepositoryCreate.js"
import { machineRepositoryCreate } from "../../machineUsers/persistence/machineRepositoryCreate.js"
import { oidcClientCompatibilitySettingsValidate } from "../../oidc/public/oidcClientCompatibilitySettingsValidate.js"
import { oidcRedirectUriValidate } from "../../oidc/public/oidcRedirectUriValidate.js"
import { oidcRepositoryCreate } from "../../oidc/persistence/oidcRepositoryCreate.js"
import { organizationRolesEncode } from "../../organizations/domain/organizationRolesEncode.js"
import { organizationDomainRepositoryCreate } from "../../organizations/persistence/organizationDomainRepositoryCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../../organizations/persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import type { OrganizationRow } from "../../organizations/persistence/organizationTable.js"
import { projectRoleKeysEncode } from "../../projects/domain/projectRoleKeysEncode.js"
import { projectRepositoryCreate } from "../../projects/persistence/projectRepositoryCreate.js"
import { realmDomainNormalize } from "../../realms/domain/realmDomainNormalize.js"
import { realmRepositoryCreate } from "../../realms/persistence/realmRepositoryCreate.js"
import { userEmailNormalize } from "../../users/domain/userEmailNormalize.js"
import { userNameNormalize } from "../../users/domain/userNameNormalize.js"
import type { UserRecord } from "../../users/persistence/userRepositoryCreate.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import { zitadelMigrationOrganizationRolesMap } from "../domain/zitadelMigrationOrganizationRolesMap.js"
import {
  normalizeSourceInstance,
  zitadelMigrationSourceRecordRepositoryCreate,
} from "../persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import {
  type ZitadelMigrationProviderCredentialBundle,
  zitadelMigrationProviderCredentialBundleSchema,
} from "../public/zitadelMigrationProviderCredentialBundleSchema.js"
import {
  type ZitadelMigrationSnapshot,
  zitadelMigrationSnapshotSchema,
} from "../public/zitadelMigrationSnapshotSchema.js"
import { zitadelMigrationDeletionExecute } from "./zitadelMigrationDeletionExecute.js"
import {
  zitadelMigrationDeletionPlanCreate,
  zitadelMigrationOidcClientSourceId,
} from "./zitadelMigrationDeletionPlanCreate.js"

type SkippedRecord = { readonly entity: string; readonly reason: string; readonly sourceId: string }
export type ZitadelMigrationImportCount = {
  readonly created: number
  readonly deleted: number
  readonly exported: number
  readonly imported: number
  readonly seen: number
  readonly skipped: number
  readonly unchanged: number
  readonly updated: number
}
export type ZitadelMigrationImportReport = {
  readonly counts: Readonly<Record<string, ZitadelMigrationImportCount>>
  readonly skipped: readonly SkippedRecord[]
  readonly unsupported: readonly SkippedRecord[]
  readonly requiresRotation: { readonly count: number; readonly sourceIds: readonly string[] }
  rotated: number
  readonly conflicts: number
  readonly deleted: number
  readonly stale: number
  readonly deletionPlan?: ReturnType<typeof zitadelMigrationDeletionPlanCreate>
  readonly incompleteCollections: readonly string[]
  readonly error?: {
    readonly code: "zitadel-migration.authoritative-incomplete"
    readonly collections: readonly string[]
  }
}
type ImportState = {
  readonly counts: Record<string, ZitadelMigrationImportCount>
  readonly organizationIds: Map<string, string>
  readonly userIds: Map<string, string>
  readonly machineIds: Map<string, string>
  readonly machineNames: Map<string, string>
  readonly machineDestinationNames: Map<string, string>
  readonly machineNameConflicts: Set<string>
  readonly skipped: SkippedRecord[]
  unsupported: SkippedRecord[]
  readonly requiresRotation: Set<string>
  rotated: number
  readonly incompleteCollections: readonly string[]
}
export type ZitadelMigrationImportOptions = {
  readonly authoritative?: boolean
  readonly database: StorageDatabase
  readonly realmId: string
  readonly snapshot: unknown
  readonly dryRun?: boolean
  readonly providerCredentialBundle?: unknown
}

const entities = [
  "users",
  "organizations",
  "organizationMemberships",
  "projects",
  "projectRoles",
  "projectGrants",
  "oidcApplications",
  "machineUsers",
  "domains",
  "loginPolicies",
  "identityProviders",
  "externalIdentityLinks",
] as const

export function zitadelMigrationImport(options: ZitadelMigrationImportOptions): Result<ZitadelMigrationImportReport> {
  const parsed = v.safeParse(zitadelMigrationSnapshotSchema, options.snapshot)
  if (!parsed.success)
    return resultErrorCodedCreate(
      "zitadelMigrationImport",
      "The migration snapshot is invalid.",
      "zitadel-migration.snapshot-invalid",
    )
  const bundle =
    options.providerCredentialBundle === undefined
      ? undefined
      : v.safeParse(zitadelMigrationProviderCredentialBundleSchema, options.providerCredentialBundle)
  if (bundle !== undefined && !bundle.success)
    return resultErrorCodedCreate(
      "zitadelMigrationImport",
      "The provider credential bundle is invalid.",
      "zitadel-migration.snapshot-invalid",
    )
  const credentials = bundle?.output
  if (credentials !== undefined) {
    if (credentials.sourceInstance.replace(/\/+$/, "").toLowerCase() !== parsed.output.sourceInstance)
      return resultErrorCodedCreate(
        "zitadelMigrationImport",
        "The provider credential bundle source does not match.",
        "zitadel-migration.source-mismatch",
      )
    for (const credential of credentials.providers) {
      const matches = parsed.output.identityProviders.filter(
        (provider) =>
          provider.authworksType === credential.type &&
          (credential.sourceId !== undefined
            ? provider.sourceId === credential.sourceId
            : provider.clientId === credential.clientId),
      )
      if (matches.length !== 1)
        return resultErrorCodedCreate(
          "zitadelMigrationImport",
          "The provider credential bundle does not uniquely match the snapshot.",
          "zitadel-migration.source-mismatch",
        )
    }
  }
  const state = importStateCreate(parsed.output)
  const incompleteCollections = state.incompleteCollections
  if (options.authoritative === true && incompleteCollections.length > 0) {
    if (options.dryRun) {
      return resultCreate({
        ...migrationReportCreate(state),
        deletionPlan: { entries: [], omissions: [] },
        error: { code: "zitadel-migration.authoritative-incomplete", collections: incompleteCollections },
      })
    }
    return resultErrorCodedCreate(
      "zitadelMigrationImport",
      `Authoritative migration requires complete collections: ${incompleteCollections.join(", ")}.`,
      "zitadel-migration.authoritative-incomplete",
    )
  }
  if (options.dryRun) {
    const realm = realmRepositoryCreate(options.database.db).realmGet(options.realmId)
    if (!realm.success) return realm
    if (realm.data === null || realm.data.status !== "active")
      return resultErrorCodedCreate(
        "zitadelMigrationImport",
        "The target Authworks realm was not found or is not active.",
        "zitadel-migration.realm-invalid",
      )
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(options.database.db).sourceRecordList(
      options.realmId,
      parsed.output.sourceInstance,
    )
    if (!mappings.success) return mappings
    return resultCreate({
      counts: state.counts,
      skipped: state.skipped,
      unsupported: state.unsupported,
      requiresRotation: { count: 0, sourceIds: [] },
      rotated: 0,
      conflicts: 0,
      deleted: 0,
      stale: 0,
      deletionPlan: zitadelMigrationDeletionPlanCreate(parsed.output, {
        realmId: options.realmId,
        mappings: mappings.data,
        skipped: [...state.skipped, ...state.unsupported],
        includeUsersAndOrganizations: true,
      }),
      incompleteCollections: incompleteCollectionsList(parsed.output),
    })
  }
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
    const sourceRecords = zitadelMigrationSourceRecordRepositoryCreate(transaction)
    for (const input of parsed.output.users) {
      const result = importUser(users, sourceRecords, options.realmId, parsed.output.sourceInstance, input, state)
      if (!result.success) return result
    }

    const organizations = organizationRepositoryCreate(transaction)
    for (const input of parsed.output.organizations) {
      const result = importOrganization(
        organizations,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
      )
      if (!result.success) return result
    }

    const domains = organizationDomainRepositoryCreate(transaction)
    const policies = organizationLoginPolicyRepositoryCreate(transaction)
    for (const input of parsed.output.domains) {
      const result = importDomain(domains, sourceRecords, options.realmId, parsed.output.sourceInstance, input, state)
      if (!result.success) return result
    }
    for (const input of parsed.output.loginPolicies) {
      const result = importLoginPolicy(
        policies,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
      )
      if (!result.success) return result
    }

    const machines = machineRepositoryCreate(transaction)
    for (const input of parsed.output.machineUsers) {
      const result = importMachineUser(
        machines,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
      )
      if (!result.success) return result
    }

    for (const input of parsed.output.organizationMemberships) {
      const result = importOrganizationMembership(
        organizations,
        users,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
      )
      if (!result.success) return result
    }

    const projects = projectRepositoryCreate(transaction)
    const oidc = oidcRepositoryCreate(transaction)
    for (const input of parsed.output.projects) {
      const result = importProject(
        projects,
        organizations,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
      )
      if (!result.success) return result
    }

    for (const input of parsed.output.projectRoles) {
      const result = importProjectRole(
        projects,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
      )
      if (!result.success) return result
    }

    for (const input of parsed.output.projectGrants) {
      const result = importProjectGrant(
        projects,
        organizations,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
      )
      if (!result.success) return result
    }

    for (const input of parsed.output.oidcApplications) {
      const result = importOidcApplication(
        projects,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
        oidc,
      )
      if (!result.success) return result
    }

    const externalIdentities = externalIdentityRepositoryCreate(transaction)
    for (const input of parsed.output.identityProviders) {
      const result = importIdentityProvider(
        externalIdentities,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
        credentials,
      )
      if (!result.success) return result
    }
    for (const input of parsed.output.externalIdentityLinks) {
      const result = importExternalIdentityLink(
        externalIdentities,
        sourceRecords,
        options.realmId,
        parsed.output.sourceInstance,
        input,
        state,
      )
      if (!result.success) return result
    }
    const mappings = sourceRecords.sourceRecordList(options.realmId, parsed.output.sourceInstance)
    if (!mappings.success) return mappings
    const plan = zitadelMigrationDeletionPlanCreate(parsed.output, {
      realmId: options.realmId,
      mappings: mappings.data,
      skipped: [...state.skipped, ...state.unsupported],
      includeUsersAndOrganizations: true,
    })
    const deleted =
      options.authoritative !== true
        ? resultCreate({ deleted: 0, stale: 0 })
        : zitadelMigrationDeletionExecute(
            plan,
            options.database,
            options.realmId,
            parsed.output.sourceInstance,
            transaction,
          )
    if (!deleted.success) return deleted
    for (const [entity, count] of Object.entries(deleted.data)) {
      if (entity === "deleted" || entity === "stale") continue
      const collection =
        entity === "oidcClient" ? "oidcApplications" : entity === "loginPolicy" ? "loginPolicies" : `${entity}s`
      for (let index = 0; index < count; index += 1) countDeleted(state, collection)
    }
    const report = migrationReportCreate(state)
    return resultCreate({
      ...report,
      deleted: deleted.data.deleted ?? 0,
      stale: deleted.data.stale ?? 0,
      deletionPlan: plan,
    })
  })
}

function importIdentityProvider(
  repository: ReturnType<typeof externalIdentityRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["identityProviders"][number],
  state: ImportState,
  credentials?: ZitadelMigrationProviderCredentialBundle,
): Result<void> {
  // A provider cannot be created from a snapshot: the destination requires a
  // client secret, and secrets are deliberately not part of the snapshot.
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "identityProvider", input.sourceId)
  if (!mapping.success) return mapping
  if (input.authworksType === null || input.authworksType === undefined)
    return unsupportedResult(state, "identityProviders", input.sourceId, "destination-credentials-required")
  const credential = credentials?.providers.find(
    (item) =>
      item.type === input.authworksType &&
      (item.sourceId !== undefined
        ? item.sourceId === input.sourceId
        : input.clientId !== undefined && item.clientId === input.clientId),
  )
  if (credentials !== undefined && credential === undefined)
    return resultErrorCodedCreate(
      "zitadelMigrationImport",
      "The provider credential is missing.",
      "zitadel-migration.source-mismatch",
    )
  const scopes = externalIdentityProviderScopesValidate(input.authworksType, credential?.scopes)
  if (!scopes.success) return scopes
  // Destination activation requires both an explicitly active source record
  // and a complete destination credential bundle.  A missing bundle must
  // never leave an already-mapped provider usable.
  const targetEnabled = credential !== undefined && input.enabled === true
  if (mapping.data === null && credential === undefined)
    return unsupportedResult(state, "identityProviders", input.sourceId, "destination-credentials-required")
  if (mapping.data === null && credential !== undefined) {
    const id = randomUUID()
    const created = repository.externalIdentityProviderCreate({
      allowAccountCreation: input.configuration?.allowAccountCreation ?? false,
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      createdAt: sourceTimestamp(input.createdAt, input),
      displayName: input.name,
      enabled: targetEnabled,
      id,
      realmId,
      organizationId: null,
      redirectUri: `${credentials!.destinationOrigin}/realms/${realmId}/external-identity/${id}/callback`,
      scopes: JSON.stringify(scopes.data),
      type: input.authworksType,
      updatedAt: sourceTimestamp(input.updatedAt ?? input.createdAt, input),
      version: 1,
    })
    if (!created.success) return created
    const stored = sourceRecords.sourceRecordUpsert({
      realmId,
      sourceInstance,
      entityType: "identityProvider",
      sourceId: input.sourceId,
      destinationId: id,
      sourceUpdatedAt: sourceTimestamp(input.updatedAt ?? input.createdAt, input),
    })
    if (!stored.success) return stored
    countCreated(state, "identityProviders")
    state.rotated += 1
    return resultCreate(undefined)
  }
  if (mapping.data === null)
    return unsupportedResult(state, "identityProviders", input.sourceId, "destination-provider-missing")
  const current = repository.externalIdentityProviderGet(realmId, mapping.data.destinationId)
  if (!current.success) return current
  if (current.data === null)
    return unsupportedResult(state, "identityProviders", input.sourceId, "destination-provider-missing")
  if (current.data.type !== input.authworksType)
    return skipResult(state, "identityProviders", input.sourceId, "provider-type-conflict")
  // Provider credentials are intentionally absent from ordinary snapshots.  A
  // mapped provider can therefore be reconciled only as disabled and must be
  // explicitly rotated afterwards.
  if (credential === undefined) {
    state.requiresRotation.add(input.sourceId)
    state.unsupported.push({
      entity: "identityProviders",
      reason: "reconfiguration-required",
      sourceId: input.sourceId,
    })
  }
  let organizationId = current.data.organizationId
  if (input.organizationId !== undefined) {
    const organization = sourceRecords.sourceRecordGet(realmId, sourceInstance, "organization", input.organizationId)
    if (!organization.success) return organization
    if (organization.data === null)
      return skipResult(state, "identityProviders", input.sourceId, "organization-not-found")
    organizationId = organization.data.destinationId
  }
  const sourceUpdatedAt = sourceTimestamp(input.updatedAt ?? input.createdAt, input)
  const targetRedirectUri =
    credentials === undefined
      ? (input.configuration?.redirectUri ?? current.data.redirectUri)
      : `${credentials.destinationOrigin}/realms/${realmId}/external-identity/${current.data.id}/callback`
  const targetScopes = input.configuration?.scopes === undefined ? current.data.scopes : JSON.stringify(scopes.data)
  const targetClientId = credential?.clientId ?? input.clientId ?? current.data.clientId
  const targetSecret = credential?.clientSecret ?? current.data.clientSecret
  const changed =
    current.data.displayName !== input.name ||
    current.data.clientId !== targetClientId ||
    current.data.organizationId !== organizationId ||
    current.data.enabled !== targetEnabled ||
    current.data.redirectUri !== targetRedirectUri ||
    current.data.scopes !== targetScopes ||
    current.data.updatedAt !== sourceUpdatedAt ||
    (credential !== undefined && current.data.clientSecret !== targetSecret) ||
    (input.configuration?.allowAccountCreation !== undefined &&
      current.data.allowAccountCreation !== input.configuration.allowAccountCreation)
  const updated = changed
    ? repository.externalIdentityProviderUpdate(realmId, current.data.id, {
        clientId: targetClientId,
        displayName: input.name,
        organizationId,
        enabled: targetEnabled,
        redirectUri: targetRedirectUri,
        scopes: targetScopes,
        ...(input.configuration?.allowAccountCreation === undefined
          ? {}
          : { allowAccountCreation: input.configuration.allowAccountCreation }),
        updatedAt: sourceUpdatedAt,
        ...(credential === undefined ? {} : { clientSecret: credential.clientSecret }),
      })
    : resultCreate(current.data)
  if (!updated.success) return updated
  const recorded = sourceRecords.sourceRecordUpsert({
    realmId,
    sourceInstance,
    entityType: "identityProvider",
    sourceId: input.sourceId,
    destinationId: current.data.id,
    sourceUpdatedAt,
  })
  if (!recorded.success) return recorded
  if (changed) countUpdated(state, "identityProviders")
  else countUnchanged(state, "identityProviders")
  if (credential !== undefined && current.data.clientSecret !== credential.clientSecret) {
    state.rotated += 1
    state.requiresRotation.delete(input.sourceId)
    state.unsupported = state.unsupported.filter(
      (item) =>
        !(
          item.entity === "identityProviders" &&
          item.sourceId === input.sourceId &&
          item.reason === "reconfiguration-required"
        ),
    )
  }
  return resultCreate(undefined)
}

function importExternalIdentityLink(
  repository: ReturnType<typeof externalIdentityRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["externalIdentityLinks"][number],
  state: ImportState,
): Result<void> {
  const userId = state.userIds.get(input.userId)
  const provider = sourceRecords.sourceRecordGet(realmId, sourceInstance, "identityProvider", input.identityProviderId)
  if (!provider.success) return provider
  if (provider.data === null)
    return skipResult(state, "externalIdentityLinks", input.sourceId, "provider-mapping-not-found")
  if (userId === undefined) return skipResult(state, "externalIdentityLinks", input.sourceId, "user-mapping-not-found")
  const collision = repository.externalIdentityGetByProviderSubject(
    realmId,
    provider.data.destinationId,
    input.externalSubject,
  )
  if (!collision.success) return collision
  if (collision.data !== null && collision.data.userId !== userId)
    return skipResult(state, "externalIdentityLinks", input.sourceId, "native-subject-collision")
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "externalIdentityLink", input.sourceId)
  if (!mapping.success) return mapping
  const now = sourceTimestamp(input.updatedAt ?? input.createdAt, input)
  const values = {
    createdAt: sourceTimestamp(input.createdAt ?? input.updatedAt, input),
    displayName: collision.data?.displayName ?? null,
    email: collision.data?.email ?? null,
    emailVerified: collision.data?.emailVerified ?? false,
    externalSubject: input.externalSubject,
    id: collision.data?.id ?? randomUUID(),
    realmId,
    providerId: provider.data.destinationId,
    updatedAt: now,
    userId,
    username: collision.data?.username ?? null,
    version: collision.data?.version ?? 1,
  }
  if (mapping.data !== null && mapping.data.destinationId !== values.id)
    return skipResult(state, "externalIdentityLinks", input.sourceId, "stable-id-conflict")
  const linkChanged =
    collision.data === null ||
    collision.data.userId !== userId ||
    collision.data.providerId !== values.providerId ||
    collision.data.externalSubject !== values.externalSubject ||
    collision.data.createdAt !== values.createdAt ||
    collision.data.updatedAt !== values.updatedAt
  const stored =
    collision.data === null
      ? repository.externalIdentityCreate(values)
      : linkChanged
        ? repository.externalIdentityUpdate(realmId, collision.data.id, values)
        : resultCreate(collision.data)
  if (!stored.success) return stored
  if (mapping.data === null) {
    const recorded = sourceRecords.sourceRecordUpsert({
      realmId,
      sourceInstance,
      entityType: "externalIdentityLink",
      sourceId: input.sourceId,
      destinationId: values.id,
      sourceUpdatedAt: now,
    })
    if (!recorded.success) return recorded
    countCreated(state, "externalIdentityLinks")
  } else if (linkChanged) countUpdated(state, "externalIdentityLinks")
  else countUnchanged(state, "externalIdentityLinks")
  return resultCreate(undefined)
}

function unsupportedResult(state: ImportState, entity: string, sourceId: string, reason: string): Result<void> {
  state.unsupported.push({ entity, reason, sourceId })
  return resultCreate(undefined)
}

function importDomain(
  repository: ReturnType<typeof organizationDomainRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["domains"][number],
  state: ImportState,
): Result<void> {
  const organizationId = state.organizationIds.get(input.organizationId)
  if (organizationId === undefined) return skipResult(state, "domains", input.sourceId, "organization-not-found")
  const normalized = realmDomainNormalize(input.domain)
  if (!normalized.success) return skipResult(state, "domains", input.sourceId, "invalid-domain")
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "domain", input.sourceId)
  if (!mapping.success) return mapping
  const current = repository.organizationDomainGet(normalized.data)
  if (!current.success) return current
  if (mapping.data === null && current.data !== null) {
    const owners = sourceRecords.sourceRecordFindByDestination(realmId, "domain", normalized.data)
    if (!owners.success) return owners
    return skipResult(
      state,
      "domains",
      input.sourceId,
      owners.data.length > 0 ? "cross-source-conflict" : "native-conflict",
    )
  }
  if (current.data !== null && current.data.organizationId !== organizationId)
    return skipResult(state, "domains", input.sourceId, "stable-id-conflict")
  if (current.data !== null && current.data.realmId !== realmId)
    return skipResult(state, "domains", input.sourceId, "stable-id-conflict")
  if (mapping.data !== null && mapping.data.destinationId !== normalized.data && current.data !== null)
    return skipResult(state, "domains", input.sourceId, "stable-id-conflict")

  const source = normalizeSourceInstance(sourceInstance)
  if (current.data !== null) {
    const owners = sourceRecords.sourceRecordFindByDestination(realmId, "domain", normalized.data)
    if (!owners.success) return owners
    if (
      owners.data.some((owner) => normalizeSourceInstance(owner.sourceInstance) !== source) ||
      !owners.data.some(
        (owner) => normalizeSourceInstance(owner.sourceInstance) === source && owner.sourceId === input.sourceId,
      )
    )
      return skipResult(state, "domains", input.sourceId, "cross-source-conflict")
  }

  let previous: typeof current.data = null
  if (mapping.data !== null && mapping.data.destinationId !== normalized.data) {
    const mapped = repository.organizationDomainGet(mapping.data.destinationId)
    if (!mapped.success) return mapped
    if (mapped.data !== null) {
      if (mapped.data.organizationId !== organizationId || mapped.data.realmId !== realmId)
        return skipResult(state, "domains", input.sourceId, "stable-id-conflict")
      const owners = sourceRecords.sourceRecordFindByDestination(realmId, "domain", mapped.data.domain)
      if (!owners.success) return owners
      if (
        owners.data.some((owner) => normalizeSourceInstance(owner.sourceInstance) !== source) ||
        !owners.data.some(
          (owner) => normalizeSourceInstance(owner.sourceInstance) === source && owner.sourceId === input.sourceId,
        )
      )
        return skipResult(state, "domains", input.sourceId, "cross-source-conflict")
      previous = mapped.data
    }
  }

  const organizationDomains = repository.organizationDomainList(organizationId)
  if (!organizationDomains.success) return organizationDomains
  if (input.isPrimary) {
    for (const domain of organizationDomains.data) {
      if (!domain.isPrimary || domain.domain === normalized.data) continue
      if (domain.realmId !== realmId) return skipResult(state, "domains", input.sourceId, "primary-conflict")
      const owners = sourceRecords.sourceRecordFindByDestination(realmId, "domain", domain.domain)
      if (!owners.success) return owners
      if (
        owners.data.length === 0 ||
        owners.data.some((owner) => normalizeSourceInstance(owner.sourceInstance) !== source)
      )
        return skipResult(state, "domains", input.sourceId, "primary-conflict")
    }
  }

  const values = {
    createdAt: sourceTimestamp(input.createdAt ?? input.updatedAt, input),
    domain: normalized.data,
    isPrimary: input.isPrimary,
    organizationId,
    realmId,
    updatedAt: sourceTimestamp(input.updatedAt ?? input.createdAt, input),
    verificationTokenHash:
      current.data?.verificationTokenHash ?? createHash("sha256").update(randomUUID()).digest("hex"),
    verified: input.verified,
    version: current.data?.version ?? 1,
  }
  if (input.isPrimary) {
    for (const domain of organizationDomains.data) {
      if (!domain.isPrimary || domain.domain === normalized.data || domain.realmId !== realmId) continue
      const demoted = repository.organizationDomainUpdate(domain.domain, {
        isPrimary: false,
        version: domain.version + 1,
      })
      if (!demoted.success) return demoted
      if (demoted.data === null)
        return resultErrorCodedCreate(
          "zitadelMigrationImport",
          "The source-owned organization domain could not be updated.",
          "zitadel-migration.write-failed",
        )
    }
  }
  if (previous !== null) {
    const removed = repository.organizationDomainDelete(previous.domain, previous.organizationId, realmId)
    if (!removed.success) return removed
    if (removed.data === null)
      return resultErrorCodedCreate(
        "zitadelMigrationImport",
        "The source-owned organization domain could not be cleared.",
        "zitadel-migration.write-failed",
      )
  }
  const saved =
    current.data === null
      ? repository.organizationDomainCreate(values)
      : repository.organizationDomainUpdate(normalized.data, values)
  if (!saved.success) return saved
  if (current.data === null) countCreated(state, "domains")
  else if (
    current.data.isPrimary === values.isPrimary &&
    current.data.verified === input.verified &&
    current.data.updatedAt === values.updatedAt
  )
    countUnchanged(state, "domains")
  else countUpdated(state, "domains")
  return sourceRecordStore(
    sourceRecords,
    realmId,
    sourceInstance,
    "domain",
    input.sourceId,
    normalized.data,
    sourceTimestamp(input.updatedAt ?? input.createdAt, input),
  )
}

function importLoginPolicy(
  repository: ReturnType<typeof organizationLoginPolicyRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["loginPolicies"][number],
  state: ImportState,
): Result<void> {
  const organizationId = state.organizationIds.get(input.organizationId)
  if (organizationId === undefined) return skipResult(state, "loginPolicies", input.sourceId, "organization-not-found")
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "loginPolicy", input.sourceId)
  if (!mapping.success) return mapping
  const current = repository.organizationLoginPolicyGet(organizationId)
  if (!current.success) return current
  if (mapping.data === null && current.data !== null)
    return skipResult(state, "loginPolicies", input.sourceId, "native-conflict")
  const values = {
    allowPassword: input.allowUsernamePassword,
    allowExternalIdentity: input.allowExternalIdp,
    organizationId,
    realmId,
    updatedAt: sourceTimestamp(input.updatedAt ?? input.createdAt, input),
    version: current.data?.version ?? 1,
  }
  const saved =
    current.data === null
      ? repository.organizationLoginPolicyCreate(values)
      : repository.organizationLoginPolicyUpdate(organizationId, values)
  if (!saved.success) return saved
  if (current.data === null) countCreated(state, "loginPolicies")
  else if (
    current.data.allowPassword === input.allowUsernamePassword &&
    current.data.allowExternalIdentity === input.allowExternalIdp
  )
    countUnchanged(state, "loginPolicies")
  else countUpdated(state, "loginPolicies")
  return sourceRecordStore(
    sourceRecords,
    realmId,
    sourceInstance,
    "loginPolicy",
    input.sourceId,
    organizationId,
    sourceTimestamp(input.updatedAt ?? input.createdAt, input),
  )
}

function importMachineUser(
  repository: ReturnType<typeof machineRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["machineUsers"][number],
  state: ImportState,
): Result<void> {
  if (state.machineNameConflicts.has(input.sourceId))
    return skipResult(state, "machineUsers", input.sourceId, "hash-name-collision")
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "machineUser", input.sourceId)
  if (!mapping.success) return mapping
  const normalizedName = userNameNormalize(input.name)
  if (!normalizedName.success) return skipResult(state, "machineUsers", input.sourceId, "invalid-name")
  let destinationName = state.machineDestinationNames.get(input.sourceId) ?? normalizedName.data
  let existing =
    mapping.data === null
      ? repository.userGetByName(realmId, destinationName)
      : repository.userGet(realmId, mapping.data.destinationId)
  if (!existing.success) return existing
  if (mapping.data !== null && existing.data !== null) destinationName = existing.data.userName
  if (mapping.data === null) {
    // Never let an unmapped import update a destination owned by another source.
    // Check both the precomputed name and the deterministic fallback independently.
    const candidates = [
      destinationName,
      `${normalizedName.data}-${machineUserSourceSuffix(sourceInstance, input.organizationId, input.sourceId)}`,
    ]
    for (const candidate of candidates) {
      const named = candidate === destinationName ? existing : repository.userGetByName(realmId, candidate)
      if (!named.success) return named
      if (named.data === null) {
        destinationName = candidate
        existing = named
        break
      }
      const owners = sourceRecords.sourceRecordFindByDestination(realmId, "machineUser", named.data.id)
      if (!owners.success) return owners
      // ownership is checked before any destination update
      if (owners.data.some((record) => record.sourceId !== input.sourceId)) {
        if (candidate === destinationName) continue
        return skipResult(state, "machineUsers", input.sourceId, "conflict")
      }
      if (owners.data.length === 0) return skipResult(state, "machineUsers", input.sourceId, "native-conflict")
      return skipResult(state, "machineUsers", input.sourceId, "conflict")
    }
  }
  const now = sourceTimestamp(input.updatedAt ?? input.createdAt, input)
  const createdAt = sourceTimestamp(input.createdAt ?? input.updatedAt, input)
  const values = {
    createdAt,
    displayName: input.name,
    userName: destinationName,
    realmId,
    scopes: JSON.stringify([]),
    status: "active",
    updatedAt: now,
    version: 1,
  }
  if (
    existing.data !== null &&
    existing.data.displayName === input.name &&
    existing.data.userName === destinationName &&
    existing.data.status === "active" &&
    existing.data.createdAt === createdAt &&
    existing.data.updatedAt === now
  ) {
    const stored = sourceRecords.sourceRecordUpsert({
      realmId,
      sourceInstance,
      entityType: "machineUser",
      sourceId: input.sourceId,
      destinationId: existing.data.id,
      sourceUpdatedAt: now,
    })
    if (!stored.success) return stored
    countUnchanged(state, "machineUsers")
    state.machineIds.set(input.sourceId, existing.data.id)
    if (input.credentials.some((credential) => credential.type === "machine-secret"))
      state.requiresRotation.add(input.sourceId)
    if (input.credentials.some((credential) => credential.type === "machine-secret" && credential.portable))
      state.unsupported.push({
        entity: "machineCredential",
        reason: "portable-credential-unsupported",
        sourceId: input.sourceId,
      })
    return resultCreate(undefined)
  }
  const saved =
    existing.data === null
      ? repository.userCreate({ ...values, id: randomUUID() })
      : repository.userUpdate(realmId, existing.data.id, values)
  if (!saved.success) return saved
  const destination = saved.data
  if (destination === null) return resultCreate(undefined)
  const stored = sourceRecords.sourceRecordUpsert({
    realmId,
    sourceInstance,
    entityType: "machineUser",
    sourceId: input.sourceId,
    destinationId: destination.id,
    sourceUpdatedAt: now,
  })
  if (!stored.success) return stored
  if (existing.data === null) countCreated(state, "machineUsers")
  else countUpdated(state, "machineUsers")
  state.machineIds.set(input.sourceId, destination.id)
  state.machineNames.set(normalizedName.data, input.organizationId)
  if (input.credentials.some((credential) => credential.type === "machine-secret"))
    state.requiresRotation.add(input.sourceId)
  if (input.credentials.some((credential) => credential.type === "machine-secret" && credential.portable))
    state.unsupported.push({
      entity: "machineCredential",
      reason: "portable-credential-unsupported",
      sourceId: input.sourceId,
    })
  return resultCreate(undefined)
}

function machineUserSourceSuffix(sourceInstance: string, organizationId: string, sourceId: string): string {
  return createHash("sha256")
    .update(`${sourceInstance.trim().toLowerCase()}\u0000${organizationId}\u0000${sourceId}`)
    .digest("hex")
    .slice(0, 12)
}

function sourceTimestamp(value: number | undefined, source: unknown): number {
  if (value !== undefined) return value
  // ZITADEL omits timestamps for some provider/link/policy records. This is a
  // stable snapshot-derived value, not a destination or wall-clock timestamp.
  const digest = createHash("sha256").update(JSON.stringify(source)).digest()
  return digest.readUInt32BE(0) + 1
}

function importUser(
  repository: ReturnType<typeof userRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["users"][number],
  state: ImportState,
): Result<void> {
  const email = userEmailNormalize(input.email)
  if (!email.success) return skipResult(state, "users", input.id, "invalid-email")
  const userName = userNameNormalize(input.userName)
  if (!userName.success) return skipResult(state, "users", input.id, "invalid-name")
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "user", input.id)
  if (!mapping.success) return mapping
  const destinationId = mapping.data?.destinationId ?? randomUUID()
  const current = repository.userGet(realmId, destinationId)
  if (!current.success) return current
  if (mapping.data === null) {
    const natural = repository.userList(realmId)
    if (!natural.success) return natural
    const naturalMatch = natural.data.find((user) => user.email === email.data || user.userName === userName.data)
    if (naturalMatch !== undefined) return skipResult(state, "users", input.id, "native-conflict")
  }

  const source = {
    createdAt: input.createdAt,
    deletedAt: input.deletedAt,
    email: email.data,
    emailVerifiedAt: input.emailVerified ? (input.emailVerifiedAt ?? input.updatedAt) : null,
    id: destinationId,
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
    userId: destinationId,
  }
  if (current.data === null) {
    const created = repository.userCreate(source, profile)
    if (!created.success) return created
    countCreated(state, "users")
    state.userIds.set(input.id, destinationId)
    return sourceRecordStore(sourceRecords, realmId, sourceInstance, "user", input.id, destinationId, input.updatedAt)
  }
  if (userEqual(current.data, source, profile)) {
    countUnchanged(state, "users")
    state.userIds.set(input.id, destinationId)
    return sourceRecordStore(sourceRecords, realmId, sourceInstance, "user", input.id, destinationId, input.updatedAt)
  }
  const updated = repository.userUpdate(realmId, destinationId, { ...source, version: current.data.version + 1 })
  if (!updated.success) return updated
  const profileUpdated = repository.userProfileUpdate(realmId, destinationId, profile)
  if (!profileUpdated.success) return profileUpdated
  countUpdated(state, "users")
  state.userIds.set(input.id, destinationId)
  return sourceRecordStore(sourceRecords, realmId, sourceInstance, "user", input.id, destinationId, input.updatedAt)
}

function importOrganization(
  repository: ReturnType<typeof organizationRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["organizations"][number],
  state: ImportState,
): Result<void> {
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "organization", input.id)
  if (!mapping.success) return mapping
  const mappedId = mapping.data?.destinationId ?? randomUUID()
  const currentById = repository.organizationGet(mappedId)
  if (!currentById.success) return currentById
  if (currentById.data !== null && currentById.data.realmId !== realmId)
    return skipResult(state, "organizations", input.id, "realm-conflict")
  if (mapping.data === null) {
    const natural = repository.organizationList(realmId)
    if (!natural.success) return natural
    if (natural.data.some((organization) => organization.name === input.name))
      return skipResult(state, "organizations", input.id, "native-conflict")
  }
  const current = currentById.data
  state.organizationIds.set(input.id, mappedId)
  const source = {
    createdAt: input.createdAt,
    id: mappedId,
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
    return sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "organization",
      input.id,
      mappedId,
      input.updatedAt,
    )
  }
  if (organizationEqual(current, source)) {
    countUnchanged(state, "organizations")
    return sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "organization",
      input.id,
      mappedId,
      input.updatedAt,
    )
  }
  const updated = repository.organizationUpdate(current.id, { ...source, version: current.version + 1 })
  if (!updated.success) return updated
  countUpdated(state, "organizations")
  return sourceRecordStore(sourceRecords, realmId, sourceInstance, "organization", input.id, mappedId, input.updatedAt)
}

function sourceRecordStore(
  repository: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  entityType: string,
  sourceId: string,
  destinationId: string,
  sourceUpdatedAt: number,
): Result<void> {
  const stored = repository.sourceRecordUpsert({
    realmId,
    sourceInstance,
    entityType,
    sourceId,
    destinationId,
    sourceVersion: String(sourceUpdatedAt),
    sourceUpdatedAt,
  })
  if (!stored.success) return stored
  return resultCreate(undefined)
}

function importOrganizationMembership(
  repository: ReturnType<typeof organizationRepositoryCreate>,
  userRepository: ReturnType<typeof userRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["organizationMemberships"][number],
  state: ImportState,
): Result<void> {
  const organizationId = state.organizationIds.get(input.organizationId) ?? input.organizationId
  const organization = repository.organizationGet(organizationId)
  if (!organization.success) return organization
  if (organization.data === null || organization.data.realmId !== realmId)
    return skipResult(state, "organizationMemberships", input.id, "organization-not-found")
  const userId = state.userIds.get(input.userId) ?? state.machineIds.get(input.userId)
  if (userId === undefined) return skipResult(state, "organizationMemberships", input.id, "user-not-found")
  if (!state.machineIds.has(input.userId)) {
    const userExists = repositoryMembershipUserExists(userRepository, realmId, userId)
    if (!userExists.success) return userExists
    if (!userExists.data) return skipResult(state, "organizationMemberships", input.id, "user-not-found")
  }
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
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "organizationMembership", input.id)
  if (!mapping.success) return mapping
  const destinationId = mapping.data?.destinationId ?? input.id
  const byId = repository.organizationMembershipGet(destinationId)
  if (!byId.success) return byId
  const byRelationship = repository.organizationMembershipGetByOrganizationUser(organizationId, userId)
  if (!byRelationship.success) return byRelationship
  if (mapping.data === null && (byId.data !== null || byRelationship.data !== null))
    return skipResult(state, "organizationMemberships", input.id, "native-conflict")
  const current = byId.data ?? byRelationship.data
  if (
    current !== null &&
    (current.realmId !== realmId || current.organizationId !== organizationId || current.userId !== userId)
  )
    return skipResult(state, "organizationMemberships", input.id, "stable-id-conflict")
  const source = {
    createdAt: input.createdAt,
    id: current?.id ?? destinationId,
    organizationId,
    realmId,
    roles: roles.data,
    updatedAt: input.updatedAt,
    userId,
    version: current?.version ?? 1,
  }
  if (current === null) {
    const created = repository.organizationMembershipCreate(source)
    if (!created.success) return created
    countCreated(state, "organizationMemberships")
    const stored = sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "organizationMembership",
      input.id,
      source.id,
      input.updatedAt,
    )
    if (!stored.success) return stored
    return resultCreate(undefined)
  }
  if (current.roles === source.roles && current.updatedAt === source.updatedAt) {
    countUnchanged(state, "organizationMemberships")
    return sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "organizationMembership",
      input.id,
      current.id,
      input.updatedAt,
    )
  }
  const updated = repository.organizationMembershipUpdate(current.id, {
    roles: source.roles,
    updatedAt: source.updatedAt,
    version: current.version + 1,
  })
  if (!updated.success) return updated
  countUpdated(state, "organizationMemberships")
  return sourceRecordStore(
    sourceRecords,
    realmId,
    sourceInstance,
    "organizationMembership",
    input.id,
    current.id,
    input.updatedAt,
  )
}

function importProject(
  repository: ReturnType<typeof projectRepositoryCreate>,
  organizationRepository: ReturnType<typeof organizationRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["projects"][number],
  state: ImportState,
): Result<void> {
  const organizationId = state.organizationIds.get(input.organizationId) ?? input.organizationId
  const organization = organizationRepository.organizationGet(organizationId)
  if (!organization.success) return organization
  if (organization.data === null || organization.data.realmId !== realmId)
    return skipResult(state, "projects", input.id, "organization-not-found")
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "project", input.id)
  if (!mapping.success) return mapping
  const destinationId = mapping.data?.destinationId ?? randomUUID()
  const current = repository.projectGet(destinationId)
  if (!current.success) return current
  if (current.data !== null && (current.data.realmId !== realmId || current.data.organizationId !== organizationId))
    return skipResult(state, "projects", input.id, "stable-id-conflict")
  const projectList = repository.projectList(realmId)
  if (!projectList.success) return projectList
  const naturalMatch =
    mapping.data === null
      ? projectList.data.find((project) => project.organizationId === organizationId && project.name === input.name)
      : undefined
  if (naturalMatch !== undefined) return skipResult(state, "projects", input.id, "stable-id-conflict")
  const source = {
    authorizationRequired: input.authorizationRequired ? 1 : 0,
    createdAt: input.createdAt,
    id: destinationId,
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
    return sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "project",
      input.id,
      destinationId,
      input.updatedAt,
    )
  }
  if (
    current.data.authorizationRequired === source.authorizationRequired &&
    current.data.name === source.name &&
    current.data.projectAccessRequired === source.projectAccessRequired &&
    current.data.status === source.status &&
    current.data.updatedAt === source.updatedAt
  ) {
    countUnchanged(state, "projects")
    return sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "project",
      input.id,
      destinationId,
      input.updatedAt,
    )
  }
  const updated = repository.projectUpdate(destinationId, { ...source, version: current.data.version + 1 })
  if (!updated.success) return updated
  countUpdated(state, "projects")
  return sourceRecordStore(sourceRecords, realmId, sourceInstance, "project", input.id, destinationId, input.updatedAt)
}

function importProjectRole(
  repository: ReturnType<typeof projectRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["projectRoles"][number],
  state: ImportState,
): Result<void> {
  const projectMapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "project", input.projectId)
  if (!projectMapping.success) return projectMapping
  const projectId = projectMapping.data?.destinationId ?? input.projectId
  const project = repository.projectGet(projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== realmId)
    return skipResult(state, "projectRoles", input.id, "project-not-found")
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "projectRole", input.id)
  if (!mapping.success) return mapping
  const destinationId = mapping.data?.destinationId ?? randomUUID()
  const byId = repository.projectRoleGet(destinationId)
  if (!byId.success) return byId
  const byKey = repository.projectRoleGetByProjectKey(projectId, input.key)
  if (!byKey.success) return byKey
  if (mapping.data === null && (byId.data !== null || byKey.data !== null))
    return skipResult(state, "projectRoles", input.id, "native-conflict")
  const current = byId.data ?? byKey.data
  if (current !== null && (current.projectId !== projectId || current.key !== input.key))
    return skipResult(state, "projectRoles", input.id, "stable-id-conflict")
  const source = {
    createdAt: input.createdAt,
    displayName: input.displayName,
    group: input.group,
    id: current?.id ?? input.id,
    key: input.key,
    projectId,
    realmId,
    updatedAt: input.updatedAt,
    version: current?.version ?? 1,
  }
  if (current === null) {
    const created = repository.projectRoleCreate(source)
    if (!created.success) return created
    countCreated(state, "projectRoles")
    return sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "projectRole",
      input.id,
      created.data.id,
      input.updatedAt,
    )
  }
  if (
    current.displayName === source.displayName &&
    current.group === source.group &&
    current.updatedAt === source.updatedAt
  ) {
    countUnchanged(state, "projectRoles")
    return sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "projectRole",
      input.id,
      current.id,
      input.updatedAt,
    )
  }
  const updated = repository.projectRoleUpdate(current.id, {
    displayName: source.displayName,
    group: source.group,
    updatedAt: source.updatedAt,
    version: current.version + 1,
  })
  if (!updated.success) return updated
  countUpdated(state, "projectRoles")
  return sourceRecordStore(sourceRecords, realmId, sourceInstance, "projectRole", input.id, current.id, input.updatedAt)
}

function importProjectGrant(
  repository: ReturnType<typeof projectRepositoryCreate>,
  organizationRepository: ReturnType<typeof organizationRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["projectGrants"][number],
  state: ImportState,
): Result<void> {
  const organizationId = state.organizationIds.get(input.organizationId) ?? input.organizationId
  const grantedOrganizationId = state.organizationIds.get(input.grantedOrganizationId) ?? input.grantedOrganizationId
  const projectMapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "project", input.projectId)
  if (!projectMapping.success) return projectMapping
  const projectId = projectMapping.data?.destinationId ?? input.projectId
  const project = repository.projectGet(projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== realmId)
    return skipResult(state, "projectGrants", input.id, "project-not-found")
  if (project.data.organizationId !== organizationId)
    return skipResult(state, "projectGrants", input.id, "project-owner-mismatch")
  if (organizationId === grantedOrganizationId)
    return skipResult(state, "projectGrants", input.id, "owner-grant-not-supported")
  const roles = repository.projectRoleList(projectId)
  if (!roles.success) return roles
  if (input.roleKeys.some((key) => !roles.data.some((role) => role.key === key)))
    return skipResult(state, "projectGrants", input.id, "project-role-not-found")
  const encoded = projectRoleKeysEncode(input.roleKeys)
  if (!encoded.success) return encoded
  const grantedOrganization = organizationRepository.organizationGet(grantedOrganizationId)
  if (!grantedOrganization.success) return grantedOrganization
  if (grantedOrganization.data === null || grantedOrganization.data.realmId !== realmId)
    return skipResult(state, "projectGrants", input.id, "granted-organization-not-found")
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "projectGrant", input.id)
  if (!mapping.success) return mapping
  const destinationId = mapping.data?.destinationId ?? randomUUID()
  const byId = repository.projectGrantGet(destinationId)
  if (!byId.success) return byId
  const byRelationship = repository.projectGrantGetByProjectOrganization(projectId, grantedOrganizationId)
  if (!byRelationship.success) return byRelationship
  if (mapping.data === null && (byId.data !== null || byRelationship.data !== null))
    return skipResult(state, "projectGrants", input.id, "native-conflict")
  const current = byId.data ?? byRelationship.data
  if (current !== null && (current.projectId !== projectId || current.grantedOrganizationId !== grantedOrganizationId))
    return skipResult(state, "projectGrants", input.id, "stable-id-conflict")
  const source = {
    createdAt: input.createdAt,
    grantedOrganizationId,
    id: current?.id ?? input.id,
    organizationId,
    projectId,
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
    return sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "projectGrant",
      input.id,
      destinationId,
      input.updatedAt,
    )
  }
  if (
    current.roleKeys === source.roleKeys &&
    current.status === source.status &&
    current.updatedAt === source.updatedAt
  ) {
    countUnchanged(state, "projectGrants")
    return sourceRecordStore(
      sourceRecords,
      realmId,
      sourceInstance,
      "projectGrant",
      input.id,
      current.id,
      input.updatedAt,
    )
  }
  const updated = repository.projectGrantUpdate(current.id, {
    roleKeys: source.roleKeys,
    status: source.status,
    updatedAt: source.updatedAt,
    version: current.version + 1,
  })
  if (!updated.success) return updated
  countUpdated(state, "projectGrants")
  return sourceRecordStore(
    sourceRecords,
    realmId,
    sourceInstance,
    "projectGrant",
    input.id,
    updated.data?.id ?? current.id,
    input.updatedAt,
  )
}

function importOidcApplication(
  repository: ReturnType<typeof projectRepositoryCreate>,
  sourceRecords: ReturnType<typeof zitadelMigrationSourceRecordRepositoryCreate>,
  realmId: string,
  sourceInstance: string,
  input: ZitadelMigrationSnapshot["oidcApplications"][number],
  state: ImportState,
  oidc: ReturnType<typeof oidcRepositoryCreate>,
): Result<void> {
  const projectMapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "project", input.projectId)
  if (!projectMapping.success) return projectMapping
  const projectId = projectMapping.data?.destinationId ?? input.projectId
  const project = repository.projectGet(projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== realmId)
    return skipResult(state, "oidcApplications", input.sourceId, "project-not-found")
  const mapping = sourceRecords.sourceRecordGet(realmId, sourceInstance, "projectApplication", input.sourceId)
  if (!mapping.success) return mapping
  const destinationId = mapping.data?.destinationId ?? randomUUID()
  const current = repository.projectApplicationGet(destinationId)
  if (!current.success) return current
  const applications = repository.projectApplicationList(projectId)
  if (!applications.success) return applications
  const nativeMatch = applications.data.find((application) => application.name === input.name)
  if (mapping.data === null && (current.data !== null || nativeMatch !== undefined))
    return skipResult(state, "oidcApplications", input.sourceId, "native-conflict")
  const redirectUris = input.redirectUris
  const postLogoutRedirectUris = input.postLogoutRedirectUris ?? []
  for (const uri of [...redirectUris, ...postLogoutRedirectUris]) {
    const valid = oidcRedirectUriValidate(uri)
    if (!valid.success)
      return resultErrorCodedCreate(
        "zitadelMigrationImport",
        "The OIDC redirect URI is invalid.",
        "zitadel-migration.snapshot-invalid",
      )
  }
  const clientSourceId = zitadelMigrationOidcClientSourceId(input.sourceId)
  const clientRecord = sourceRecords.sourceRecordGet(realmId, sourceInstance, "oidcClient", clientSourceId)
  if (!clientRecord.success) return clientRecord
  const applicationId = destinationId
  const oidcMapping = oidc.clientGet(realmId, clientRecord.data?.destinationId ?? "")
  if (!oidcMapping.success) return oidcMapping
  const client = oidcMapping.data
  const clientByApplication = oidc.clientList(realmId)
  if (!clientByApplication.success) return clientByApplication
  const existingClient = client ?? clientByApplication.data.find((item) => item.applicationId === applicationId) ?? null
  const allowedScopes = input.allowedScopes ?? ["openid"]
  const requireConsent = input.requireConsent ?? true
  const trusted = input.trusted ?? false
  const compatibility = oidcClientCompatibilitySettingsValidate({
    accessTokenRoleAssertion: input.accessTokenRoleAssertion,
    additionalOrigins: input.additionalOrigins,
    idTokenUserinfoAssertion: input.idTokenUserinfoAssertion,
  })
  if (!compatibility.success) return compatibility
  const clientSource = {
    allowedScopes: JSON.stringify(allowedScopes),
    applicationId,
    accessTokenRoleAssertion: compatibility.data.accessTokenRoleAssertion ? 1 : 0,
    clientType: input.clientType,
    createdAt: input.createdAt,
    id: existingClient?.id ?? randomUUID(),
    realmId,
    name: input.name,
    postLogoutRedirectUris: JSON.stringify(postLogoutRedirectUris),
    projectId,
    redirectUris: JSON.stringify(redirectUris),
    additionalOrigins: JSON.stringify(compatibility.data.additionalOrigins),
    idTokenUserinfoAssertion: compatibility.data.idTokenUserinfoAssertion ? 1 : 0,
    requireConsent: requireConsent ? 1 : 0,
    secretHash: existingClient?.secretHash ?? null,
    status: input.status,
    trusted: trusted ? 1 : 0,
    updatedAt: input.updatedAt,
    version: existingClient?.version ?? 1,
  }
  if (input.credentials.some((credential) => credential.portable))
    state.unsupported.push({
      entity: "oidcCredential",
      reason: "portable-credential-unsupported",
      sourceId: input.sourceId,
    })
  if (
    input.clientType === "confidential" &&
    !input.credentials.some((credential) => credential.available && credential.portable)
  ) {
    state.requiresRotation.add(input.sourceId)
    state.skipped.push({ entity: "oidcCredential", reason: "requires-explicit-rotation", sourceId: input.sourceId })
  }
  const source = {
    id: destinationId,
    realmId,
    projectId,
    name: input.name,
    applicationType: "oidc" as const,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    version: current.data?.version ?? 1,
  }
  if (current.data === null) {
    const created = repository.projectApplicationCreate(source)
    if (!created.success) return created
    countCreated(state, "oidcApplications")
  } else if (
    current.data.projectId === projectId &&
    current.data.name === source.name &&
    current.data.status === source.status &&
    current.data.createdAt === source.createdAt &&
    current.data.updatedAt === source.updatedAt
  )
    countUnchanged(state, "oidcApplications")
  else {
    const updated = repository.projectApplicationUpdate(destinationId, { ...source, version: current.data.version + 1 })
    if (!updated.success) return updated
    countUpdated(state, "oidcApplications")
  }
  const clientChanged =
    existingClient === null ||
    Object.entries(clientSource).some(([key, value]) => existingClient[key as keyof typeof existingClient] !== value)
  const clientResult =
    existingClient === null
      ? oidc.clientCreate(clientSource)
      : clientChanged
        ? oidc.clientUpdate(realmId, existingClient.id, { ...clientSource, version: existingClient.version + 1 })
        : resultCreate(existingClient)
  if (!clientResult.success) return clientResult
  if (clientResult.data === null)
    return resultErrorCodedCreate(
      "zitadelMigrationImport",
      "The OIDC client was not stored.",
      "zitadel-migration.write-failed",
    )
  const clientStored = sourceRecordStore(
    sourceRecords,
    realmId,
    sourceInstance,
    "oidcClient",
    clientSourceId,
    clientResult.data.id,
    input.updatedAt,
  )
  if (!clientStored.success) return clientStored
  return sourceRecordStore(
    sourceRecords,
    realmId,
    sourceInstance,
    "projectApplication",
    input.sourceId,
    destinationId,
    input.updatedAt,
  )
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
  const counts: Record<string, ZitadelMigrationImportCount> = {}
  for (const entity of entities) {
    const seen = snapshot[entity].length
    counts[entity] = { created: 0, deleted: 0, exported: 0, imported: 0, seen, skipped: 0, unchanged: 0, updated: 0 }
  }
  const machineDestinationNames = new Map<string, string>()
  const machineNameConflicts = new Set<string>()
  const machineSuffixOwners = new Map<string, string>()
  const groups = new Map<string, typeof snapshot.machineUsers>()
  for (const input of snapshot.machineUsers) {
    const normalized = userNameNormalize(input.name)
    if (!normalized.success) continue
    const group = groups.get(normalized.data) ?? []
    group.push(input)
    groups.set(normalized.data, group)
  }
  for (const [name, group] of groups) {
    const needsSuffix = group.length > 1
    const suffixes = new Map<string, string>()
    for (const input of group) {
      const identity = `${snapshot.sourceInstance}\u0000${input.organizationId}\u0000${input.sourceId}`
      const suffix = machineUserSourceSuffix(snapshot.sourceInstance, input.organizationId, input.sourceId)
      if (suffixes.has(suffix) && suffixes.get(suffix) !== identity) {
        machineNameConflicts.add(input.sourceId)
        const owner = machineSuffixOwners.get(`${name}\u0000${suffix}`)
        if (owner !== undefined) machineNameConflicts.add(owner)
      }
      suffixes.set(suffix, identity)
      machineSuffixOwners.set(`${name}\u0000${suffix}`, input.sourceId)
      machineDestinationNames.set(input.sourceId, needsSuffix ? `${name}-${suffix}` : name)
    }
  }
  return {
    counts,
    organizationIds: new Map(),
    userIds: new Map(),
    machineIds: new Map(),
    machineNames: new Map(),
    machineDestinationNames,
    machineNameConflicts,
    skipped: [],
    unsupported: [...snapshot.unsupported],
    requiresRotation: new Set(),
    rotated: 0,
    incompleteCollections: incompleteCollectionsList(snapshot),
  }
}

function migrationReportCreate(state: ImportState): ZitadelMigrationImportReport {
  const sourceIds = [...state.requiresRotation].sort()
  return {
    counts: state.counts,
    skipped: state.skipped,
    unsupported: state.unsupported,
    requiresRotation: { count: sourceIds.length, sourceIds },
    rotated: state.rotated,
    conflicts: new Set(
      state.skipped
        .filter((item) => item.reason.includes("conflict"))
        .map((item) => `${item.entity}\u0000${item.sourceId}`),
    ).size,
    deleted: 0,
    stale: 0,
    incompleteCollections: state.incompleteCollections,
  }
}

function incompleteCollectionsList(snapshot: ZitadelMigrationSnapshot): readonly string[] {
  return Object.entries(snapshot.completeness)
    .filter(([, collection]) => !collection.complete)
    .map(([name]) => name)
    .sort()
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

function countDeleted(state: ImportState, entity: string) {
  const count = state.counts[entity]
  if (count !== undefined) state.counts[entity] = { ...count, deleted: count.deleted + 1 }
}
