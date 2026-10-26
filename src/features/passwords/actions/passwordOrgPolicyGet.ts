import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationContextAuthorize } from "../../organizations/actions/organizationContextAuthorize.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { passwordPolicyResolve } from "../domain/passwordPolicyResolve.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"

type PasswordOrgPolicyGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly organizationId: string
  readonly realmId: string
}

export function passwordOrgPolicyGet(options: PasswordOrgPolicyGetOptions): Result<{ policy: PasswordPolicy }> {
  const op = "passwordOrgPolicyGet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(
      op,
      "The password policy is not available in this tenant context.",
      "passwords.tenant-mismatch",
    )
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The realm is not active.", "passwords.not-active")
  const organizations = organizationRepositoryCreate(options.database.db)
  const organization = organizations.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (organization.data === null || organization.data.realmId !== options.realmId)
    return resultErrorCreate(op, "The organization was not found.", "passwords.not-found")
  const authorized = organizationContextAuthorize({
    context: options.context,
    database: options.database,
    organization: organization.data,
    repository: organizations,
    requiredRole: "admin",
  })
  if (!authorized.success) return authorized
  const resolved = passwordPolicyResolve({
    executor: options.database.db,
    organizationId: options.organizationId,
    realmId: options.realmId,
  })
  if (!resolved.success) return resolved
  return resultCreate({ policy: resolved.data })
}
