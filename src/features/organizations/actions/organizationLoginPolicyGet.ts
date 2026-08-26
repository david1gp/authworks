import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationLoginPolicyOverrideViewCreate } from "../domain/organizationLoginPolicyOverrideViewCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationLoginPolicyResponse } from "../public/organizationLoginPolicyResponseSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"
import { organizationLoginPolicyResolve } from "./organizationLoginPolicyResolve.js"

type OrganizationLoginPolicyGetOptions = {
  readonly context?: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
}

export function organizationLoginPolicyGet(
  options: OrganizationLoginPolicyGetOptions,
): Result<OrganizationLoginPolicyResponse> {
  const organization = organizationRepositoryCreate(options.database.db).organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCodedCreate(
      "organizationLoginPolicyGet",
      "The organization was not found.",
      "organizations.not-found",
    )
  if (options.context !== undefined) {
    if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
      return resultErrorCodedCreate(
        "organizationLoginPolicyGet",
        "The organization is not available in this tenant context.",
        "organizations.tenant-mismatch",
      )
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository: organizationRepositoryCreate(options.database.db),
      requiredPermission: "organization.read",
    })
    if (!authorized.success) return authorized
  }
  const policy = organizationLoginPolicyResolve(options)
  if (!policy.success) return policy
  const override = organizationLoginPolicyRepositoryCreate(options.database.db).organizationLoginPolicyGet(
    options.organizationId,
  )
  if (!override.success) return override
  const overrides = organizationLoginPolicyOverrideViewCreate(override.data)
  if (!overrides.success) return overrides
  return resultCreate({
    realmId: options.realmId,
    organizationId: options.organizationId,
    overrides: overrides.data,
    policy: policy.data,
  })
}
