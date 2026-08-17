import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { httpErrorResponseSchema } from "../../../platform/http/httpErrorResponseSchema.js"
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

type MachineApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type MachineUserApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: MachineApiFetch
  readonly token?: Secret | string
}

export function machineUserApiClientCreate(options: MachineUserApiClientCreateOptions) {
  const request = async <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> => {
    const op = "machineUserApiClientRequest"
    const headers = new Headers(init.headers)
    headers.set("accept", "application/json")
    if (init.body !== undefined) headers.set("content-type", "application/json")
    if (options.token !== undefined)
      headers.set(
        "authorization",
        `Bearer ${options.token instanceof Secret ? options.token.valueGet() : options.token}`,
      )
    try {
      const response = await (options.fetch ?? fetch)(new URL(path, options.baseUrl), { ...init, headers })
      const body = await response.json().catch(() => undefined)
      if (!response.ok) {
        const parsedError = v.safeParse(httpErrorResponseSchema, body)
        if (!parsedError.success) return resultErrorCreate(op, `The server returned HTTP ${response.status}.`)
        return resultErrorCreate(op, `${parsedError.output.error.code}: ${parsedError.output.error.message}`)
      }
      const parsed = v.safeParse(schema, body)
      if (!parsed.success) return resultErrorCreate(op, "The server returned an invalid response.")
      return resultCreate(parsed.output)
    } catch (_error) {
      return resultErrorCreate(op, "The server could not be reached.")
    }
  }

  const managementPath = (instanceId: string, suffix = "") =>
    `/system/instances/${encodeURIComponent(instanceId)}${suffix}`

  return {
    machineApiKeyCreate(
      instanceId: string,
      machineUserId: string,
      input: MachineApiKeyCreateRequest,
    ): Promise<Result<MachineCredentialIssueResponse>> {
      const parsed = v.safeParse(machineApiKeyCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("machineUserApiClientApiKeyCreate", "The API key request is invalid."))
      return request(
        managementPath(instanceId, `/machine-users/${encodeURIComponent(machineUserId)}/api-keys`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },

    machineCredentialList(instanceId: string, machineUserId: string): Promise<Result<MachineCredentialListResponse>> {
      return request(
        managementPath(instanceId, `/machine-users/${encodeURIComponent(machineUserId)}/credentials`),
        { method: "GET" },
        machineCredentialListResponseSchema,
      )
    },

    machineCredentialRevoke(
      instanceId: string,
      credentialId: string,
      input: MachineCredentialRevokeRequest = {},
    ): Promise<Result<MachineCredentialRevokeResponse>> {
      const parsed = v.safeParse(machineCredentialRevokeRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("machineUserApiClientCredentialRevoke", "The revocation request is invalid."),
        )
      return request(
        managementPath(instanceId, `/machine-credentials/${encodeURIComponent(credentialId)}/revoke`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialRevokeResponseSchema,
      )
    },

    machinePersonalAccessTokenCreate(
      instanceId: string,
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
        managementPath(instanceId, `/machine-users/${encodeURIComponent(machineUserId)}/personal-access-tokens`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },

    machineUserClientSecretRotate(
      instanceId: string,
      machineUserId: string,
    ): Promise<Result<MachineUserSecretRotateResponse>> {
      return request(
        managementPath(instanceId, `/machine-users/${encodeURIComponent(machineUserId)}/client-secret/rotate`),
        { method: "POST" },
        machineUserSecretRotateResponseSchema,
      )
    },

    machineUserCreate(instanceId: string, input: MachineUserCreateRequest): Promise<Result<MachineUserCreateResponse>> {
      const parsed = v.safeParse(machineUserCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(resultErrorCreate("machineUserApiClientCreate", "The machine user request is invalid."))
      return request(
        managementPath(instanceId, "/machine-users"),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineUserCreateResponseSchema,
      )
    },

    machineUserGet(instanceId: string, machineUserId: string): Promise<Result<MachineUserResponse>> {
      return request(
        managementPath(instanceId, `/machine-users/${encodeURIComponent(machineUserId)}`),
        { method: "GET" },
        machineUserResponseSchema,
      )
    },

    machineUserLifecycleSet(
      instanceId: string,
      machineUserId: string,
      input: MachineUserLifecycleRequest,
    ): Promise<Result<MachineUserResponse>> {
      const parsed = v.safeParse(machineUserLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("machineUserApiClientLifecycleSet", "The lifecycle request is invalid."),
        )
      return request(
        managementPath(instanceId, `/machine-users/${encodeURIComponent(machineUserId)}/lifecycle`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineUserResponseSchema,
      )
    },

    machineUserList(instanceId: string): Promise<Result<MachineUserListResponse>> {
      return request(managementPath(instanceId, "/machine-users"), { method: "GET" }, machineUserListResponseSchema)
    },

    machineProtectedApiGet(instanceId: string): Promise<Result<unknown>> {
      return request(`/instances/${encodeURIComponent(instanceId)}/protected-api`, { method: "GET" }, v.unknown())
    },

    machineCredentialIssue(
      instanceId: string,
      input: MachineCredentialIssueRequest,
    ): Promise<Result<MachineCredentialIssueResponse>> {
      const parsed = v.safeParse(machineCredentialIssueRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate("machineUserApiClientCredentialIssue", "The credential request is invalid."),
        )
      return request(
        managementPath(instanceId, `/machine-users/${encodeURIComponent(parsed.output.machineUserId)}/api-keys`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },
  }
}
