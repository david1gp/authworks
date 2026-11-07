import * as v from "valibot"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpApiClientRequest } from "../../../platform/http/httpApiClientRequest.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listQueryToSearchParams } from "../../../platform/http/listQueryToSearchParams.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { sessionBrowserRequest } from "../../sessions/client/sessionBrowserRequest.js"
import { type TeamCreateRequest, teamCreateRequestSchema } from "../public/teamCreateRequestSchema.js"
import { type TeamDeleteResponse, teamDeleteResponseSchema } from "../public/teamDeleteResponseSchema.js"
import { type TeamListResponse, teamListResponseSchema } from "../public/teamListResponseSchema.js"
import { type TeamMemberAssignRequest, teamMemberAssignRequestSchema } from "../public/teamMemberAssignRequestSchema.js"
import {
  type TeamMemberAssignResponse,
  teamMemberAssignResponseSchema,
} from "../public/teamMemberAssignResponseSchema.js"
import {
  type TeamMemberUnassignResponse,
  teamMemberUnassignResponseSchema,
} from "../public/teamMemberUnassignResponseSchema.js"
import { type TeamResponse, teamResponseSchema } from "../public/teamResponseSchema.js"
import { type TeamUpdateRequest, teamUpdateRequestSchema } from "../public/teamUpdateRequestSchema.js"

type TeamApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type TeamApiClientCreateOptions = {
  readonly baseUrl: string
  readonly csrfToken?: string
  readonly fetch?: TeamApiFetch
  readonly token?: Secret | string
}

export function teamApiClientCreate(options: TeamApiClientCreateOptions) {
  const request = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init,
      op: "teamApiClientRequest",
      path,
      schema,
      token: options.token,
    })
  const browserRequestInit = (init: RequestInit): RequestInit => {
    const headers = new Headers(init.headers)
    if (options.csrfToken !== undefined) headers.set("x-csrf-token", options.csrfToken)
    return { ...init, credentials: "same-origin", headers }
  }
  const browserRequest = <T>(path: string, init: RequestInit, schema: v.GenericSchema<T>): Promise<Result<T>> =>
    httpApiClientRequest({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
      init: browserRequestInit(init),
      op: "teamApiClientTenantRequest",
      path,
      schema,
    })
  const tenantMutation = <T>(
    realmId: string,
    op: string,
    path: string,
    init: RequestInit,
    schema: v.GenericSchema<T>,
  ): Promise<Result<T>> => {
    if (options.token !== undefined) return request(path, init, schema)
    if (options.csrfToken !== undefined) return browserRequest(path, init, schema)
    return sessionBrowserRequest({ baseUrl: options.baseUrl, fetch: options.fetch, init, op, path, realmId, schema })
  }
  const teamPath = (realmId: string, organizationId: string, suffix = "") =>
    `/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(organizationId)}/teams${suffix}`
  const teamRefPath = (realmId: string, organizationId: string, teamRef: string, suffix = "") =>
    teamPath(realmId, organizationId, `/${encodeURIComponent(teamRef)}${suffix}`)

  return {
    teamCreate(realmId: string, organizationId: string, input: TeamCreateRequest): Promise<Result<TeamResponse>> {
      const parsed = v.safeParse(teamCreateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("teamApiClientCreate", "The team request is invalid.", "teams.invalid"),
        )
      return tenantMutation(
        realmId,
        "teamApiClientCreate",
        teamPath(realmId, organizationId),
        { body: JSON.stringify(parsed.output), method: "POST" },
        teamResponseSchema,
      )
    },
    teamList(realmId: string, organizationId: string, query?: ListQuery): Promise<Result<TeamListResponse>> {
      return tenantMutation(
        realmId,
        "teamApiClientList",
        `${teamPath(realmId, organizationId)}${listQueryToSearchParams(query)}`,
        { method: "GET" },
        teamListResponseSchema,
      )
    },
    teamGet(realmId: string, organizationId: string, teamRef: string): Promise<Result<TeamResponse>> {
      return tenantMutation(
        realmId,
        "teamApiClientGet",
        teamRefPath(realmId, organizationId, teamRef),
        { method: "GET" },
        teamResponseSchema,
      )
    },
    teamUpdate(
      realmId: string,
      organizationId: string,
      teamRef: string,
      input: TeamUpdateRequest,
    ): Promise<Result<TeamResponse>> {
      const parsed = v.safeParse(teamUpdateRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("teamApiClientUpdate", "The team update is invalid.", "teams.invalid"),
        )
      return tenantMutation(
        realmId,
        "teamApiClientUpdate",
        teamRefPath(realmId, organizationId, teamRef),
        { body: JSON.stringify(parsed.output), method: "PATCH" },
        teamResponseSchema,
      )
    },
    teamDelete(realmId: string, organizationId: string, teamRef: string): Promise<Result<TeamDeleteResponse>> {
      return tenantMutation(
        realmId,
        "teamApiClientDelete",
        teamRefPath(realmId, organizationId, teamRef),
        { method: "DELETE" },
        teamDeleteResponseSchema,
      )
    },
    teamMemberAssign(
      realmId: string,
      organizationId: string,
      teamRef: string,
      input: TeamMemberAssignRequest,
    ): Promise<Result<TeamMemberAssignResponse>> {
      const parsed = v.safeParse(teamMemberAssignRequestSchema, input)
      if (!parsed.success)
        return Promise.resolve(
          resultErrorCodedCreate("teamApiClientMemberAssign", "The team member request is invalid.", "teams.invalid"),
        )
      return tenantMutation(
        realmId,
        "teamApiClientMemberAssign",
        teamRefPath(realmId, organizationId, teamRef, "/members"),
        { body: JSON.stringify(parsed.output), method: "POST" },
        teamMemberAssignResponseSchema,
      )
    },
    teamMemberUnassign(
      realmId: string,
      organizationId: string,
      teamRef: string,
      userId: string,
    ): Promise<Result<TeamMemberUnassignResponse>> {
      return tenantMutation(
        realmId,
        "teamApiClientMemberUnassign",
        teamRefPath(realmId, organizationId, teamRef, `/members/${encodeURIComponent(userId)}`),
        { method: "DELETE" },
        teamMemberUnassignResponseSchema,
      )
    },
  }
}
