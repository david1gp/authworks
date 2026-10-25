import * as v from "valibot"
import { createResult, createResultError, type Result } from "#result"
import { organizationListResponseSchema } from "../../src/features/organizations/public/organizationListResponseSchema.js"
import { organizationPurgeResponseSchema } from "../../src/features/organizations/public/organizationPurgeResponseSchema.js"
import { organizationResponseSchema } from "../../src/features/organizations/public/organizationResponseSchema.js"
import { passwordLoginResponseSchema } from "../../src/features/passwords/public/passwordLoginResponseSchema.js"
import { projectDeleteResponseSchema } from "../../src/features/projects/public/projectDeleteResponseSchema.js"
import { projectListResponseSchema } from "../../src/features/projects/public/projectListResponseSchema.js"
import { realmAdministratorListResponseSchema } from "../../src/features/realms/public/realmAdministratorListResponseSchema.js"
import { sessionBrowserModeHeaderName } from "../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
import { sessionCsrfResponseSchema } from "../../src/features/sessions/public/sessionCsrfResponseSchema.js"
import { sessionRevocationResponseSchema } from "../../src/features/sessions/public/sessionRevocationResponseSchema.js"
import { userListResponseSchema } from "../../src/features/users/public/userListResponseSchema.js"
import { userPurgeResponseSchema } from "../../src/features/users/public/userPurgeResponseSchema.js"
import { userResponseSchema } from "../../src/features/users/public/userResponseSchema.js"
import { resultErrorCodedCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"

export type E2eServiceApiClient = {
  readonly administratorsList: (
    realmId: string,
  ) => Promise<Result<v.InferOutput<typeof realmAdministratorListResponseSchema>>>
  readonly administratorRevoke: (realmId: string, userId: string) => Promise<Result<{ readonly userId: string }>>
  readonly close: () => Promise<Result<void>>
  readonly cookieGet: () => string
  readonly csrfTokenGet: () => string
  readonly organizationsList: (
    realmId: string,
    pageToken?: string,
  ) => Promise<Result<v.InferOutput<typeof organizationListResponseSchema>>>
  readonly organizationLifecycleSet: (
    realmId: string,
    organizationId: string,
    status: "removed",
  ) => Promise<Result<v.InferOutput<typeof organizationResponseSchema>>>
  readonly organizationPurge: (
    realmId: string,
    organizationId: string,
  ) => Promise<Result<v.InferOutput<typeof organizationPurgeResponseSchema>>>
  readonly projectsList: (
    realmId: string,
    pageToken?: string,
  ) => Promise<Result<v.InferOutput<typeof projectListResponseSchema>>>
  readonly projectDelete: (
    realmId: string,
    projectId: string,
  ) => Promise<Result<v.InferOutput<typeof projectDeleteResponseSchema>>>
  readonly realmId: string
  readonly usersList: (
    realmId: string,
    pageToken?: string,
  ) => Promise<Result<v.InferOutput<typeof userListResponseSchema>>>
  readonly usersDeletedList: (
    realmId: string,
    pageToken?: string,
  ) => Promise<Result<v.InferOutput<typeof userListResponseSchema>>>
  readonly userDelete: (realmId: string, userId: string) => Promise<Result<v.InferOutput<typeof userResponseSchema>>>
  readonly userPurge: (
    realmId: string,
    userId: string,
  ) => Promise<Result<v.InferOutput<typeof userPurgeResponseSchema>>>
}

type E2eServiceApiClientCreateOptions = {
  readonly baseUrl: string
  readonly password: string
  readonly username: string
}

const pageSize = 100

/**
 * Service-user API client for E2E data management. Signs in with password login in browser
 * mode (session cookie + CSRF header), resolves the realm via organization discovery, and
 * exposes the typed tenant calls the cleanup needs. `close()` revokes the session.
 */
export function e2eServiceApiClientCreate(
  options: E2eServiceApiClientCreateOptions,
): Promise<Result<E2eServiceApiClient>> {
  const op = "e2eServiceApiClientCreate"
  if (options.baseUrl.length === 0) return Promise.resolve(createResultError(op, "The API origin is required."))
  if (options.username.length === 0)
    return Promise.resolve(createResultError(op, "The service-user username is required."))
  if (options.password.length === 0)
    return Promise.resolve(createResultError(op, "The service-user password is required."))

  const baseUrl = options.baseUrl.replace(/\/+$/, "")
  return (async (): Promise<Result<E2eServiceApiClient>> => {
    const jar: string[] = []
    const cookieStore = (response: Response): void => {
      for (const header of response.headers.getSetCookie?.() ?? []) {
        const pair = header.split(";")[0] ?? ""
        if (pair.length === 0) continue
        const name = pair.split("=")[0] ?? ""
        if (name !== "session" && name !== "csrf") continue
        const kept = jar.filter((candidate) => !candidate.startsWith(`${name}=`))
        jar.length = 0
        jar.push(...kept, pair)
      }
    }
    const cookieHeader = (): string => jar.join("; ")

    // The public origin defaults to the API origin: on dev both are login.localhost, on
    // production both are the production host. An explicit AUTHWORKS_E2E_PUBLIC_ORIGIN wins.
    const publicOrigin = e2eServicePublicOriginGet(baseUrl)
    const tenantHost = (() => {
      try {
        const configured = new URL(publicOrigin).hostname
        return configured.length > 0 ? configured : "login.localhost"
      } catch {
        return "login.localhost"
      }
    })()
    const rawRequest = async (
      path: string,
      init: RequestInit,
      operation: string,
    ): Promise<Result<{ readonly body: unknown; readonly status: number }>> => {
      const headers = new Headers(init.headers)
      headers.set("host", tenantHost)
      headers.set("accept", "application/json")
      if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json")
      const cookies = cookieHeader()
      if (cookies.length > 0) headers.set("cookie", cookies)
      if (!headers.has("origin")) headers.set("origin", baseUrl)
      let response: Response
      try {
        response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: "include" })
      } catch {
        return createResultError(op, `${operation}: the server could not be reached at ${baseUrl}${path}.`)
      }
      cookieStore(response)
      let body: unknown
      try {
        body = await response.json()
      } catch {
        body = undefined
      }
      return createResult({ body, status: response.status })
    }

    const parsedRequest = async <TSchema extends v.GenericSchema>(
      path: string,
      init: RequestInit,
      schema: TSchema,
      operation: string,
    ): Promise<Result<v.InferOutput<TSchema>>> => {
      const fetched = await rawRequest(path, init, operation)
      if (!fetched.success) return fetched
      if (fetched.data.status < 200 || fetched.data.status >= 300) {
        const errorBody =
          typeof fetched.data.body === "object" && fetched.data.body !== null && "error" in fetched.data.body
            ? (fetched.data.body as { error: unknown }).error
            : undefined
        const detail = errorBody === undefined ? `status ${fetched.data.status}` : JSON.stringify(errorBody)
        const code =
          typeof errorBody === "object" && errorBody !== null && "code" in errorBody
            ? (errorBody as { code: unknown }).code
            : undefined
        // Propagate the server error code so callers can match on it (cleanup tolerates
        // already-deleted and not-found responses); unknown shapes keep the plain error.
        if (typeof code === "string")
          return resultErrorCodedCreate(op, `${operation}: ${path} failed: ${detail}.`, code)
        return createResultError(op, `${operation}: ${path} failed: ${detail}.`)
      }
      const parsed = v.safeParse(schema, fetched.data.body)
      if (!parsed.success) return createResultError(op, `${operation}: the response from ${path} did not validate.`)
      return createResult(parsed.output)
    }

    // Mutations are origin-checked against the public origin, not the direct base URL
    // host, so send the public origin on browser-mode mutations.
    const mutationOrigin = publicOrigin
    const browserHeaders = (csrfToken: string): Headers => {
      const headers = new Headers()
      headers.set(sessionBrowserModeHeaderName, "true")
      headers.set("x-csrf-token", csrfToken)
      headers.set("origin", mutationOrigin)
      return headers
    }

    // Sign in: password login resolves the tenant from the Host header, and a bare host
    // like 127.0.0.1 serves no realm, so resolve the discovery host from the public origin.
    const originHost = tenantHost
    const discovered = await parsedRequest(
      `/organization-discovery?domain=${encodeURIComponent(originHost)}`,
      { headers: { host: originHost }, method: "GET" },
      v.looseObject({ found: v.boolean(), organization: v.optional(v.looseObject({ realmId: v.string() })) }),
      `${op}.discovery`,
    )
    if (!discovered.success) return discovered
    if (!discovered.data.found || discovered.data.organization === undefined)
      return createResultError(op, `${op}.discovery: no realm serves the domain "${originHost}".`)
    const realmId = discovered.data.organization.realmId

    const loginHeaders = new Headers({ "content-type": "application/json" })
    loginHeaders.set(sessionBrowserModeHeaderName, "true")
    const loggedIn = await parsedRequest(
      `/realms/${encodeURIComponent(realmId)}/password/login`,
      {
        body: JSON.stringify({ identifier: options.username, password: options.password }),
        headers: loginHeaders,
        method: "POST",
      },
      passwordLoginResponseSchema,
      `${op}.login`,
    )
    if (!loggedIn.success) return loggedIn
    if (loggedIn.data.challenge !== undefined || loggedIn.data.passwordChangeRequired === true)
      return createResultError(op, "The service user cannot sign in: an MFA challenge or password change is required.")

    const csrf = await parsedRequest(
      `/realms/${encodeURIComponent(realmId)}/sessions/csrf`,
      { headers: { cookie: cookieHeader(), origin: baseUrl }, method: "GET" },
      sessionCsrfResponseSchema,
      `${op}.csrf`,
    )
    if (!csrf.success) return csrf
    const csrfToken = csrf.data.csrfToken

    const authed = <TSchema extends v.GenericSchema>(
      path: string,
      init: RequestInit,
      schema: TSchema,
      operation: string,
    ): Promise<Result<v.InferOutput<TSchema>>> => {
      const headers = browserHeaders(csrfToken)
      for (const [name, value] of new Headers(init.headers).entries()) headers.set(name, value)
      return parsedRequest(path, { ...init, headers }, schema, operation)
    }
    const listPath = (path: string, pageToken: string | undefined): string => {
      const separator = path.includes("?") ? "&" : "?"
      return pageToken === undefined
        ? `${path}${separator}pageSize=${pageSize}`
        : `${path}${separator}pageSize=${pageSize}&pageToken=${encodeURIComponent(pageToken)}`
    }
    const revokeSchema = v.strictObject({ userId: v.string() })

    const client: E2eServiceApiClient = {
      cookieGet: () => cookieHeader(),
      csrfTokenGet: () => csrfToken,
      administratorsList: (targetRealmId) =>
        authed(
          `/realms/${encodeURIComponent(targetRealmId)}/administrators`,
          { method: "GET" },
          realmAdministratorListResponseSchema,
          `${op}.administratorsList`,
        ),
      administratorRevoke: (targetRealmId, userId) =>
        authed(
          `/realms/${encodeURIComponent(targetRealmId)}/administrators/${encodeURIComponent(userId)}`,
          { method: "DELETE" },
          revokeSchema,
          `${op}.administratorRevoke`,
        ),
      close: async () => {
        const loggedOut = await authed(
          `/realms/${encodeURIComponent(realmId)}/sessions/logout`,
          { body: JSON.stringify({}), method: "POST" },
          sessionRevocationResponseSchema,
          `${op}.logout`,
        )
        jar.length = 0
        if (!loggedOut.success) return loggedOut
        return createResult(undefined)
      },
      organizationsList: (targetRealmId, pageToken) =>
        authed(
          listPath(`/realms/${encodeURIComponent(targetRealmId)}/organizations`, pageToken),
          { method: "GET" },
          organizationListResponseSchema,
          `${op}.organizationsList`,
        ),
      organizationLifecycleSet: (targetRealmId, organizationId, status) =>
        authed(
          `/realms/${encodeURIComponent(targetRealmId)}/organizations/${encodeURIComponent(organizationId)}/lifecycle`,
          { body: JSON.stringify({ status }), method: "POST" },
          organizationResponseSchema,
          `${op}.organizationLifecycleSet`,
        ),
      organizationPurge: (targetRealmId, organizationId) =>
        authed(
          `/realms/${encodeURIComponent(targetRealmId)}/organizations/${encodeURIComponent(organizationId)}/purge`,
          { body: JSON.stringify({}), method: "POST" },
          organizationPurgeResponseSchema,
          `${op}.organizationPurge`,
        ),
      projectsList: (targetRealmId, pageToken) =>
        authed(
          listPath(`/realms/${encodeURIComponent(targetRealmId)}/projects`, pageToken),
          { method: "GET" },
          projectListResponseSchema,
          `${op}.projectsList`,
        ),
      projectDelete: (targetRealmId, projectId) =>
        authed(
          `/realms/${encodeURIComponent(targetRealmId)}/projects/${encodeURIComponent(projectId)}`,
          { method: "DELETE" },
          projectDeleteResponseSchema,
          `${op}.projectDelete`,
        ),
      realmId,
      usersList: (targetRealmId, pageToken) =>
        authed(
          listPath(
            `/realms/${encodeURIComponent(targetRealmId)}/users?search=${encodeURIComponent("e2e-aw-")}`,
            pageToken,
          ),
          { method: "GET" },
          userListResponseSchema,
          `${op}.usersList`,
        ),
      usersDeletedList: (targetRealmId, pageToken) =>
        authed(
          listPath(
            `/realms/${encodeURIComponent(targetRealmId)}/users?search=${encodeURIComponent("e2e-aw-")}&state=deleted`,
            pageToken,
          ),
          { method: "GET" },
          userListResponseSchema,
          `${op}.usersDeletedList`,
        ),
      userDelete: (targetRealmId, userId) =>
        authed(
          `/realms/${encodeURIComponent(targetRealmId)}/users/${encodeURIComponent(userId)}`,
          { method: "DELETE" },
          userResponseSchema,
          `${op}.userDelete`,
        ),
      userPurge: (targetRealmId, userId) =>
        authed(
          `/realms/${encodeURIComponent(targetRealmId)}/users/${encodeURIComponent(userId)}/purge`,
          { body: JSON.stringify({}), method: "POST" },
          userPurgeResponseSchema,
          `${op}.userPurge`,
        ),
    }
    return createResult(client)
  })().catch((error) =>
    createResultError(
      op,
      error instanceof Error && error.message.length > 0
        ? error.message
        : "The service API client could not be created.",
    ),
  )
}

function e2eServicePublicOriginGet(baseUrl: string): string {
  for (const candidate of [process.env.AUTHWORKS_E2E_PUBLIC_ORIGIN, baseUrl]) {
    if (candidate === undefined || candidate.length === 0) continue
    let origin: string | undefined
    try {
      origin = new URL(candidate).origin
    } catch {
      origin = undefined
    }
    if (origin !== undefined) return origin
  }
  return baseUrl
}
