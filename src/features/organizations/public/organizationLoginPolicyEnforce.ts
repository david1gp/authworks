import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationLoginPolicyProviderIdsParse } from "../domain/organizationLoginPolicyProviderIdsParse.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationLoginPolicyResolve } from "./organizationLoginPolicyResolve.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import type { OrganizationLoginMethod } from "./organizationLoginMethod.js"

type OrganizationLoginPolicyEnforceOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly method: OrganizationLoginMethod
  readonly organizationId?: string
  readonly providerId?: string
}

export function organizationLoginPolicyEnforce(options: OrganizationLoginPolicyEnforceOptions): Result<void> {
  const policy = organizationLoginPolicyResolve(options)
  if (!policy.success) return resultErrorCreate("organizationLoginPolicyEnforce", "The login method is unavailable.")
  if (!organizationLoginPolicyMethodAllowed(policy.data, options.method))
    return resultErrorCreate("organizationLoginPolicyEnforce", "The login method is disabled for this organization.")
  if (options.method === "external_identity" && options.providerId !== undefined) {
    const providerIds = organizationLoginPolicyProviderIdsResolve(options)
    if (!providerIds.success) return providerIds
    if (providerIds.data !== null && !providerIds.data.includes(options.providerId))
      return resultErrorCreate(
        "organizationLoginPolicyEnforce",
        "The identity provider is disabled for this organization.",
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
  if (method === "passkey") return policy.allowPasskey
  return policy.allowExternalIdentity
}

function organizationLoginPolicyProviderIdsResolve(
  options: OrganizationLoginPolicyEnforceOptions,
): Result<string[] | null> {
  const repository = organizationLoginPolicyRepositoryCreate(options.database.db)
  const instance = repository.instanceLoginPolicyGet(options.instanceId)
  if (!instance.success) return instance
  if (options.organizationId === undefined)
    return resultCreate(organizationLoginPolicyProviderIdsParse(instance.data?.providerIds))
  const organization = repository.organizationLoginPolicyGet(options.organizationId)
  if (!organization.success) return organization
  return resultCreate(
    organizationLoginPolicyProviderIdsParse(organization.data?.providerIds) ??
      organizationLoginPolicyProviderIdsParse(instance.data?.providerIds),
  )
}
