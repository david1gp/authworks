import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listQueryToSearchParams } from "../../../platform/http/listQueryToSearchParams.js"
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
import { machineProtectedApiResponseSchema } from "../public/machineProtectedApiResponseSchema.js"
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
  readonly csrfToken?: string
  readonly fetch?: MachineApiFetch
  readonly systemToken?: Secret | string
  readonly token?: Secret | string
}

export function machineUserApiClientCreate(options: MachineUserApiClientCreateOptions) {
  const systemRequestToken = "systemToken" in options ? options.systemToken : options.token
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
  const managementRequest = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "machineUserApiClientRequest",
      path,
      schema,
      token: systemRequestToken,
    })

  const managementPath = (realmId: string, suffix = "") => `/system/realms/${encodeURIComponent(realmId)}${suffix}`
  const browserPath = (realmId: string, suffix = "") => `/realms/${encodeURIComponent(realmId)}${suffix}`
  const browserRequestInit = (init: RequestInit): RequestInit => {
    const headers = new Headers(init.headers)
    if (options.csrfToken !== undefined) headers.set("x-csrf-token", options.csrfToken)
    return { ...init, credentials: "same-origin", headers }
  }
  const browserRequest = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    request(path, browserRequestInit(init), schema)

  return {
    machineApiKeyCreate(
      realmId: string,
      machineUserId: string,
      input: MachineApiKeyCreateRequest,
    ): Promise<Result<MachineCredentialIssueResponse>> {
      const parsed = v.safeParse(machineApiKeyCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "machineUserApiClientApiKeyCreate",
            "The API key request is invalid.",
            "machine-users.invalid",
          ),
        )
      return managementRequest(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/api-keys`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },

    machineCredentialList(
      realmId: string,
      machineUserId: string,
      query?: ListQuery,
    ): Promise<Result<MachineCredentialListResponse>> {
      return managementRequest(
        `${managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/credentials`)}${listQueryToSearchParams(query)}`,
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
          resultErrorCreate(
            "machineUserApiClientCredentialRevoke",
            "The revocation request is invalid.",
            "machine-users.invalid",
          ),
        )
      return managementRequest(
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
            "machine-users.invalid",
          ),
        )
      return managementRequest(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/personal-access-tokens`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },

    machineUserClientSecretRotate(
      realmId: string,
      machineUserId: string,
    ): Promise<Result<MachineUserSecretRotateResponse>> {
      return managementRequest(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/client-secret/rotate`),
        { method: "POST" },
        machineUserSecretRotateResponseSchema,
      )
    },

    machineUserCreate(realmId: string, input: MachineUserCreateRequest): Promise<Result<MachineUserCreateResponse>> {
      const parsed = v.safeParse(machineUserCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "machineUserApiClientCreate",
            "The machine user request is invalid.",
            "machine-users.invalid",
          ),
        )
      return managementRequest(
        managementPath(realmId, "/machine-users"),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineUserCreateResponseSchema,
      )
    },

    machineUserGet(realmId: string, machineUserId: string): Promise<Result<MachineUserResponse>> {
      return managementRequest(
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
          resultErrorCreate(
            "machineUserApiClientLifecycleSet",
            "The lifecycle request is invalid.",
            "machine-users.invalid",
          ),
        )
      return managementRequest(
        managementPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/lifecycle`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineUserResponseSchema,
      )
    },

    machineUserList(realmId: string, query?: ListQuery): Promise<Result<MachineUserListResponse>> {
      return managementRequest(
        `${managementPath(realmId, "/machine-users")}${listQueryToSearchParams(query)}`,
        { method: "GET" },
        machineUserListResponseSchema,
      )
    },

    machineUserTenantCreate(
      realmId: string,
      input: MachineUserCreateRequest,
    ): Promise<Result<MachineUserCreateResponse>> {
      const parsed = v.safeParse(machineUserCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "machineUserApiClientTenantCreate",
            "The machine user request is invalid.",
            "machine-users.invalid",
          ),
        )
      return browserRequest(
        browserPath(realmId, "/machine-users"),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineUserCreateResponseSchema,
      )
    },

    machineUserTenantGet(realmId: string, machineUserId: string): Promise<Result<MachineUserResponse>> {
      return browserRequest(
        browserPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}`),
        { method: "GET" },
        machineUserResponseSchema,
      )
    },

    machineUserTenantLifecycleSet(
      realmId: string,
      machineUserId: string,
      input: MachineUserLifecycleRequest,
    ): Promise<Result<MachineUserResponse>> {
      const parsed = v.safeParse(machineUserLifecycleRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "machineUserApiClientTenantLifecycleSet",
            "The lifecycle request is invalid.",
            "machine-users.invalid",
          ),
        )
      return browserRequest(
        browserPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/lifecycle`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineUserResponseSchema,
      )
    },

    machineUserTenantList(realmId: string, query?: ListQuery): Promise<Result<MachineUserListResponse>> {
      return browserRequest(
        `${browserPath(realmId, "/machine-users")}${listQueryToSearchParams(query)}`,
        { method: "GET" },
        machineUserListResponseSchema,
      )
    },

    machineUserTenantClientSecretRotate(
      realmId: string,
      machineUserId: string,
    ): Promise<Result<MachineUserSecretRotateResponse>> {
      return browserRequest(
        browserPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/client-secret/rotate`),
        { method: "POST" },
        machineUserSecretRotateResponseSchema,
      )
    },

    machineUserTenantCredentialList(
      realmId: string,
      machineUserId: string,
      query?: ListQuery,
    ): Promise<Result<MachineCredentialListResponse>> {
      return browserRequest(
        `${browserPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/credentials`)}${listQueryToSearchParams(query)}`,
        { method: "GET" },
        machineCredentialListResponseSchema,
      )
    },

    machineUserTenantPersonalAccessTokenCreate(
      realmId: string,
      machineUserId: string,
      input: MachinePersonalAccessTokenCreateRequest,
    ): Promise<Result<MachineCredentialIssueResponse>> {
      const parsed = v.safeParse(machinePersonalAccessTokenCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "machineUserApiClientTenantPersonalAccessTokenCreate",
            "The personal access token request is invalid.",
            "machine-users.invalid",
          ),
        )
      return browserRequest(
        browserPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/personal-access-tokens`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },

    machineUserTenantApiKeyCreate(
      realmId: string,
      machineUserId: string,
      input: MachineApiKeyCreateRequest,
    ): Promise<Result<MachineCredentialIssueResponse>> {
      const parsed = v.safeParse(machineApiKeyCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "machineUserApiClientTenantApiKeyCreate",
            "The API key request is invalid.",
            "machine-users.invalid",
          ),
        )
      return browserRequest(
        browserPath(realmId, `/machine-users/${encodeURIComponent(machineUserId)}/api-keys`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },

    machineUserTenantCredentialRevoke(
      realmId: string,
      credentialId: string,
      input: MachineCredentialRevokeRequest = {},
    ): Promise<Result<MachineCredentialRevokeResponse>> {
      const parsed = v.safeParse(machineCredentialRevokeRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCreate(
            "machineUserApiClientTenantCredentialRevoke",
            "The revocation request is invalid.",
            "machine-users.invalid",
          ),
        )
      return browserRequest(
        browserPath(realmId, `/machine-credentials/${encodeURIComponent(credentialId)}/revoke`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialRevokeResponseSchema,
      )
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
          resultErrorCreate(
            "machineUserApiClientCredentialIssue",
            "The credential request is invalid.",
            "machine-users.invalid",
          ),
        )
      return managementRequest(
        managementPath(realmId, `/machine-users/${encodeURIComponent(parsed.output.machineUserId)}/api-keys`),
        { body: JSON.stringify(parsed.output), method: "POST" },
        machineCredentialIssueResponseSchema,
      )
    },
  }
}
