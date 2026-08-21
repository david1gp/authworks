import type { Result } from "#result"
import type { MachineApiKeyCreateRequest } from "../public/machineApiKeyCreateRequestSchema.js"
import type { MachineCredentialListResponse } from "../public/machineCredentialListResponseSchema.js"
import type { MachineCredential } from "../public/machineCredentialSchema.js"
import type { MachinePersonalAccessTokenCreateRequest } from "../public/machinePersonalAccessTokenCreateRequestSchema.js"
import type { MachineUserCreateRequest } from "../public/machineUserCreateRequestSchema.js"
import type { MachineUserLifecycleRequest } from "../public/machineUserLifecycleRequestSchema.js"
import type { MachineUserListResponse } from "../public/machineUserListResponseSchema.js"
import type { MachineUser } from "../public/machineUserSchema.js"

/**
 * A newly issued machine credential. The secret is returned exactly once by the server and
 * is never recoverable afterwards, so it only ever travels through this value.
 */
export type MachineAdminCredentialIssue = {
  readonly credential: MachineCredential
  readonly secret: string
}

/** A newly issued or rotated client-credentials pair, shown exactly once. */
export type MachineAdminClientSecretIssue = {
  readonly clientId: string
  readonly clientSecret: string
  readonly machineUser: MachineUser
}

/**
 * The single boundary separating the shared stateless machine-user administration views
 * from their production (network) and demo (fixture) data sources. There is deliberately
 * no operation that reads an existing secret: stored values are write-only.
 */
export type MachineAdminAdapter = {
  readonly apiKeyCreate: (
    machineUserId: string,
    input: MachineApiKeyCreateRequest,
  ) => Promise<Result<MachineAdminCredentialIssue>>
  readonly clientSecretRotate: (machineUserId: string) => Promise<Result<MachineAdminClientSecretIssue>>
  readonly credentialList: (machineUserId: string, pageToken?: string) => Promise<Result<MachineCredentialListResponse>>
  readonly credentialRevoke: (credentialId: string, reason?: string) => Promise<Result<MachineCredential>>
  readonly machineUserCreate: (input: MachineUserCreateRequest) => Promise<Result<MachineAdminClientSecretIssue>>
  readonly machineUserGet: (machineUserId: string) => Promise<Result<MachineUser>>
  readonly machineUserLifecycleSet: (
    machineUserId: string,
    input: MachineUserLifecycleRequest,
  ) => Promise<Result<MachineUser>>
  readonly machineUserList: (pageToken?: string) => Promise<Result<MachineUserListResponse>>
  readonly personalAccessTokenCreate: (
    machineUserId: string,
    input: MachinePersonalAccessTokenCreateRequest,
  ) => Promise<Result<MachineAdminCredentialIssue>>
}
