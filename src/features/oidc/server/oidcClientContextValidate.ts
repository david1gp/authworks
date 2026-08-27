import { type Result } from "#result"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { projectOidcContextValidate } from "../../projects/server/projectOidcContextValidate.js"

type OidcClientContextValidateOptions = {
  readonly applicationId?: string | null
  readonly executor: StorageExecutor
  readonly organizationId?: string | null
  readonly projectId?: string | null
  readonly realmId: string
}

export function oidcClientContextValidate(options: OidcClientContextValidateOptions): Result<void> {
  return projectOidcContextValidate(options)
}
