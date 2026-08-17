import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { machineCredentialIssue } from "./machineCredentialIssue.js"
import type { MachineCredentialIssueRequest } from "../public/machineCredentialIssueRequestSchema.js"
import type { MachineCredentialIssueResponse } from "../public/machineCredentialIssueResponseSchema.js"
import type { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

type MachinePersonalAccessTokenCreateOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: MachineCredentialIssueRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function machinePersonalAccessTokenCreate(
  options: MachinePersonalAccessTokenCreateOptions,
): Result<MachineCredentialIssueResponse> {
  return machineCredentialIssue({ ...options, kind: "personal_access_token" })
}
