import { type Result } from "#result"
import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import type { MachineCredentialIssueRequest } from "../public/machineCredentialIssueRequestSchema.js"
import type { MachineCredentialIssueResponse } from "../public/machineCredentialIssueResponseSchema.js"
import { machineCredentialIssue } from "./machineCredentialIssue.js"

type MachineApiKeyCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: MachineCredentialIssueRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machineApiKeyCreate(options: MachineApiKeyCreateOptions): Result<MachineCredentialIssueResponse> {
  return machineCredentialIssue({ ...options, kind: "api_key" })
}
