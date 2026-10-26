import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"
import { passwordOrgPolicyViewCreate } from "./passwordOrgPolicyViewCreate.js"
import { passwordPolicyDefaults } from "./passwordPolicyDefaults.js"
import { passwordPolicyViewCreate } from "./passwordPolicyViewCreate.js"

type PasswordPolicyResolveOptions = {
  readonly executor: StorageExecutor
  readonly organizationId?: string
  readonly realmId: string
}

export function passwordPolicyResolve(options: PasswordPolicyResolveOptions): Result<PasswordPolicy> {
  const repository = passwordRepositoryCreate(options.executor)
  if (options.organizationId !== undefined) {
    const override = repository.passwordOrgPolicyGet(options.realmId, options.organizationId)
    if (!override.success) return override
    if (override.data !== null) return resultCreate(passwordOrgPolicyViewCreate(override.data))
  }
  const row = repository.passwordPolicyGet(options.realmId)
  if (!row.success) return row
  if (row.data === null) return resultCreate(passwordPolicyDefaults)
  return resultCreate(passwordPolicyViewCreate(row.data))
}
