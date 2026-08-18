import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import {
  type MachineApiKeyCreateRequest,
  machineApiKeyCreateRequestSchema,
} from "../public/machineApiKeyCreateRequestSchema.js"
import {
  type MachineCredentialIssueRequest,
  machineCredentialIssueRequestSchema,
} from "../public/machineCredentialIssueRequestSchema.js"
import {
  type MachineCredentialIssueResponse,
  machineCredentialIssueResponseSchema,
} from "../public/machineCredentialIssueResponseSchema.js"
import {
  type MachineCredentialListResponse,
  machineCredentialListResponseSchema,
} from "../public/machineCredentialListResponseSchema.js"
import {
  type MachineCredentialRevokeRequest,
  machineCredentialRevokeRequestSchema,
} from "../public/machineCredentialRevokeRequestSchema.js"
import {
  type MachineCredentialRevokeResponse,
  machineCredentialRevokeResponseSchema,
} from "../public/machineCredentialRevokeResponseSchema.js"
import {
  type MachinePersonalAccessTokenCreateRequest,
  machinePersonalAccessTokenCreateRequestSchema,
} from "../public/machinePersonalAccessTokenCreateRequestSchema.js"
import {
  type MachineUserCreateRequest,
  machineUserCreateRequestSchema,
} from "../public/machineUserCreateRequestSchema.js"
import {
  type MachineUserCreateResponse,
  machineUserCreateResponseSchema,
} from "../public/machineUserCreateResponseSchema.js"
import {
  type MachineUserLifecycleRequest,
  machineUserLifecycleRequestSchema,
} from "../public/machineUserLifecycleRequestSchema.js"
import { type MachineUserListResponse, machineUserListResponseSchema } from "../public/machineUserListResponseSchema.js"
import { type MachineUserResponse, machineUserResponseSchema } from "../public/machineUserResponseSchema.js"
import {
  type MachineUserSecretRotateResponse,
  machineUserSecretRotateResponseSchema,
} from "../public/machineUserSecretRotateResponseSchema.js"
import { machineProtectedApiResponseSchema } from "../public/machineProtectedApiResponseSchema.js"

type MachineApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type MachineUserApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: MachineApiFetch
  readonly token?: Secret | string
}

export function machineUserApiClientCreate(options: MachineUserApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "machineUserApiClientRequest",
      path,
      schema,
      token: options.token,
    })

  const managementPath = (realmId: string, suffix = "") => `/system/realms/${encodeURIComponent(realmId)}${suffix}`

  return {
    machineApiKeyCreate(
      realmId: string,
      machineUserId: string,
      input: MachineApiKeyCreateRequest,
    ): Promise<Result<MachineCredentialIssueResponse>> {
      const parsed = v.safeParse(machineApiKeyCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("machineUserApiClientApiKeyCreate", "The API key request is invalid."))
      return request(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/api-keys`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },

    machineCredentialList(realmId: string, machineUserId: string): Promise<Result<MachineCredentialListResponse>> {
      return request(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/credentials`),
        { method: "GET" },
        machineCredentialListResponseSchema,
      )
    },

    machineCredentialRevoke(
      realmId: string,
      credentialId: string,
      input: MachineCredentialRevokeRequest = {},
    ): Promise<Result<MachineCredentialRevokeResponse>> {
      const parsed = v.safeParse(machineCredentialRevokeRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("machineUserApiClientCredentialRevoke", "The revocation request is invalid."),
        )
      return request(
        managementPath(realmId, `/machine-credentials/${encodeURIComponent(credentialId)}/revoke`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialRevokeResponseSchema,
      )
    },

    machinePersonalAccessTokenCreate(
      realmId: string,
      machineUserId: string,
      input: MachinePersonalAccessTokenCreateRequest,
    ): Promise<Result<MachineCredentialIssueResponse>> {
      const parsed = v.safeParse(machinePersonalAccessTokenCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "machineUserApiClientPersonalAccessTokenCreate",
            "The personal access token request is invalid.",
          ),
        )
      return request(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/personal-access-tokens`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },

    machineUserClientSecretRotate(
      realmId: string,
      machineUserId: string,
    ): Promise<Result<MachineUserSecretRotateResponse>> {
      return request(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/client-secret/rotate`),
        { method: "POST" },
        machineUserSecretRotateResponseSchema,
      )
    },

    machineUserCreate(realmId: string, input: MachineUserCreateRequest): Promise<Result<MachineUserCreateResponse>> {
      const parsed = v.safeParse(machineUserCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("machineUserApiClientCreate", "The machine user request is invalid."))
      return request(
        managementPath(realmId, "/machine-users"),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineUserCreateResponseSchema,
      )
    },

    machineUserGet(realmId: string, machineUserId: string): Promise<Result<MachineUserResponse>> {
      return request(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}`),
        { method: "GET" },
        machineUserResponseSchema,
      )
    },

    machineUserLifecycleSet(
      realmId: string,
      machineUserId: string,
      input: MachineUserLifecycleRequest,
    ): Promise<Result<MachineUserResponse>> {
      const parsed = v.safeParse(machineUserLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("machineUserApiClientLifecycleSet", "The lifecycle request is invalid."),
        )
      return request(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/lifecycle`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineUserResponseSchema,
      )
    },

    machineUserList(realmId: string): Promise<Result<MachineUserListResponse>> {
      return request(managementPath(realmId, "/machine-users"), { method: "GET" }, machineUserListResponseSchema)
    },

    machineProtectedApiGet(realmId: string) {
      return request(
        `/realms/${encodeURIComponent(realmId)}/protected-api`,
        { method: "GET" },
        machineProtectedApiResponseSchema,
      )
    },

    machineCredentialIssue(
      realmId: string,
      input: MachineCredentialIssueRequest,
    ): Promise<Result<MachineCredentialIssueResponse>> {
      const parsed = v.safeParse(machineCredentialIssueRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("machineUserApiClientCredentialIssue", "The credential request is invalid."),
        )
      return request(
        managementPath(realmId, `/machine-users/${encodeURIComponent(parsed.output.machineUserId)}/api-keys`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },
  }
}
