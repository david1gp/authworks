import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationLoginPolicyProviderIdsParse } from "../domain/organizationLoginPolicyProviderIdsParse.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import type { OrganizationLoginMethod } from "../public/organizationLoginMethod.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import { organizationLoginPolicyResolve } from "./organizationLoginPolicyResolve.js"

type OrganizationLoginPolicyEnforceOptions = {
  readonly database: StorageDatabase
  readonly executor?: StorageExecutor
  readonly realmId: string
  readonly method: OrganizationLoginMethod
  readonly organizationId?: string
  readonly providerId?: string
}

export function organizationLoginPolicyEnforce(options: OrganizationLoginPolicyEnforceOptions): Result<void> {
  const policy = organizationLoginPolicyResolve(options)
  if (!policy.success)
    return resultErrorCodedCreate(
      "organizationLoginPolicyEnforce",
      "The login method is unavailable.",
      "organizations.not-found",
    )
  if (!organizationLoginPolicyMethodAllowed(policy.data, options.method))
    return resultErrorCodedCreate(
      "organizationLoginPolicyEnforce",
      "The login method is disabled for this organization.",
      "organizations.login-method-disabled",
    )
  if (options.method === "external_identity" && options.providerId !== undefined) {
    const providerIds = organizationLoginPolicyProviderIdsResolve(options)
    if (!providerIds.success) return providerIds
    if (providerIds.data !== null && !providerIds.data.includes(options.providerId))
      return resultErrorCodedCreate(
        "organizationLoginPolicyEnforce",
        "The identity provider is disabled for this organization.",
        "organizations.provider-disabled",
      )
  }
  return resultCreate(undefined)
}

function organizationLoginPolicyMethodAllowed(
  policy: OrganizationLoginPolicy,
  method: OrganizationLoginMethod,
): boolean {
  if (method === "password") return policy.allowPassword
  if (method === "email_otp") return policy.allowEmailOtp
  if (method === "whatsapp_otp") return policy.allowWhatsappOtp ?? true
  if (method === "passkey") return policy.allowPasskey
  return policy.allowExternalIdentity
}

function organizationLoginPolicyProviderIdsResolve(
  options: OrganizationLoginPolicyEnforceOptions,
): Result<string[] | null> {
  const repository = organizationLoginPolicyRepositoryCreate(options.executor ?? options.database.db)
  const realm = repository.realmLoginPolicyGet(options.realmId)
  if (!realm.success) return realm
  if (options.organizationId === undefined)
    return resultCreate(organizationLoginPolicyProviderIdsParse(realm.data?.providerIds))
  const organization = repository.organizationLoginPolicyGet(options.organizationId)
  if (!organization.success) return organization
  return resultCreate(
    organizationLoginPolicyProviderIdsParse(organization.data?.providerIds) ??
      organizationLoginPolicyProviderIdsParse(realm.data?.providerIds),
  )
}
