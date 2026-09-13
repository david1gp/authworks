import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { externalIdentityRepositoryCreate } from "../../externalIdentities/persistence/externalIdentityRepositoryCreate.js"
import { machineRepositoryCreate } from "../../machineUsers/persistence/machineRepositoryCreate.js"
import { oidcRepositoryCreate } from "../../oidc/persistence/oidcRepositoryCreate.js"
import { organizationDomainRepositoryCreate } from "../../organizations/persistence/organizationDomainRepositoryCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../../organizations/persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { projectRepositoryCreate } from "../../projects/persistence/projectRepositoryCreate.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import {
  normalizeSourceInstance,
  zitadelMigrationSourceRecordRepositoryCreate,
} from "../persistence/zitadelMigrationSourceRecordRepositoryCreate.js"
import type { ZitadelMigrationDeletionPlan } from "./zitadelMigrationDeletionPlanCreate.js"

export type ZitadelMigrationDeletionCounts = Readonly<Record<string, number>>

export function zitadelMigrationDeletionExecute(
  plan: ZitadelMigrationDeletionPlan,
  database: StorageDatabase,
  realmId: string,
  sourceInstance: string,
  activeTransaction?: StorageExecutor,
): Result<ZitadelMigrationDeletionCounts> {
  const op = "zitadelMigrationDeletionExecute"
  const supported = new Set([
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
  ])
  if (
    plan.entries.some(
      (entry) =>
        !supported.has(entry.entityType) ||
        entry.sourceId.trim() === "" ||
        entry.destinationId.trim() === "" ||
        entry.reason !== "absent-from-complete-collection",
    )
  )
    return resultErrorCodedCreate(
      op,
      "The deletion plan contains an unsupported entity type.",
      "zitadel-migration.invalid-plan",
    )
  const execute = (transaction: StorageExecutor): Result<ZitadelMigrationDeletionCounts> => {
    const source = normalizeSourceInstance(sourceInstance)
    const mappings = zitadelMigrationSourceRecordRepositoryCreate(transaction)
    const counts: Record<string, number> = { deleted: 0, stale: 0 }
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
    ]
    const entries = [...plan.entries].sort((a, b) => order.indexOf(a.entityType) - order.indexOf(b.entityType))
    const now = Date.now()

    for (const entry of entries) {
      const mapping = mappings.sourceRecordGet(realmId, source, entry.entityType, entry.sourceId)
      if (!mapping.success) return mapping
      if (
        mapping.data === null ||
        mapping.data.realmId !== realmId ||
        normalizeSourceInstance(mapping.data.sourceInstance) !== source ||
        mapping.data.entityType !== entry.entityType ||
        mapping.data.sourceId !== entry.sourceId ||
        mapping.data.destinationId !== entry.destinationId
      )
        return resultErrorCodedCreate(
          op,
          "The deletion mapping does not match the requested source record.",
          "zitadel-migration.source-mismatch",
        )

      const deleted = deleteDestination(entry.entityType, entry.destinationId, realmId, transaction, now)
      if (!deleted.success) return deleted
      const removed = mappings.sourceRecordDelete(realmId, source, entry.entityType, entry.sourceId)
      if (!removed.success) return removed
      if (deleted.data) {
        counts[entry.entityType] = (counts[entry.entityType] ?? 0) + 1
        counts.deleted = (counts.deleted ?? 0) + 1
      } else counts.stale = (counts.stale ?? 0) + 1
    }
    return resultCreate(counts)
  }
  return activeTransaction === undefined ? storageTransactionRun(database, execute) : execute(activeTransaction)
}

function deleteDestination(
  entityType: string,
  destinationId: string,
  realmId: string,
  database: StorageExecutor,
  now: number,
): Result<boolean> {
  switch (entityType) {
    case "machineUser": {
      const repository = machineRepositoryCreate(database)
      const revoked = repository.credentialRevokeForUser(realmId, destinationId, now)
      if (!revoked.success) return revoked
      const deleted = repository.userDelete(realmId, destinationId)
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    case "user": {
      const deleted = userRepositoryCreate(database).userDelete(realmId, destinationId)
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    case "organization": {
      const deleted = organizationRepositoryCreate(database).organizationDelete(realmId, destinationId)
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    case "project":
    case "projectRole":
    case "projectGrant":
    case "projectApplication": {
      const repository = projectRepositoryCreate(database)
      const deleted =
        entityType === "project"
          ? repository.projectDelete(destinationId)
          : entityType === "projectRole"
            ? repository.projectRoleDelete(destinationId)
            : entityType === "projectGrant"
              ? repository.projectGrantDelete(destinationId)
              : repository.projectApplicationDelete(destinationId)
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    case "oidcClient": {
      const deleted = oidcRepositoryCreate(database).clientDelete(realmId, destinationId)
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    case "organizationMembership": {
      const deleted = organizationRepositoryCreate(database).organizationMembershipDelete(destinationId, realmId)
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    case "domain": {
      const repository = organizationDomainRepositoryCreate(database)
      const current = repository.organizationDomainGet(destinationId)
      if (!current.success) return current
      if (current.data === null) return resultCreate(false)
      const deleted = repository.organizationDomainDelete(destinationId, current.data.organizationId, realmId)
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    case "loginPolicy": {
      const current = organizationLoginPolicyRepositoryCreate(database).organizationLoginPolicyGet(destinationId)
      if (!current.success) return current
      if (current.data === null) return resultCreate(false)
      const deleted = organizationLoginPolicyRepositoryCreate(database).organizationLoginPolicyDelete(
        current.data.organizationId,
        realmId,
      )
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    case "identityProvider": {
      const deleted = externalIdentityRepositoryCreate(database).externalIdentityProviderDelete(realmId, destinationId)
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    case "externalIdentityLink": {
      const deleted = externalIdentityRepositoryCreate(database).externalIdentityDeleteById(realmId, destinationId)
      return deleted.success ? resultCreate(deleted.data !== null) : deleted
    }
    default:
      return resultErrorCodedCreate(
        "deleteDestination",
        "The deletion plan contains an unsupported entity type.",
        "zitadel-migration.invalid-plan",
      )
  }
}
