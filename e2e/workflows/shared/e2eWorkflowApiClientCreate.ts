import * as v from "valibot"
import { passwordLoginResponseSchema } from "../../../src/features/passwords/public/passwordLoginResponseSchema.js"
import { sessionBrowserModeHeaderName } from "../../../src/features/sessions/public/sessionBrowserModeHeaderName.js"
import { sessionCsrfResponseSchema } from "../../../src/features/sessions/public/sessionCsrfResponseSchema.js"

type E2eWorkflowApiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type E2eWorkflowApiClientCreateOptions = {
  readonly baseUrl: string
  readonly fetch?: E2eWorkflowApiFetch
}

type E2eWorkflowApiSession = {
  readonly cookie: string
  readonly csrfToken: string
  readonly realmId: string
  readonly userId: string
}

/**
 * Minimal cookie-session API client for E2E data setup: password login in browser mode, realm
 * discovery, and an authenticated fetch (session cookie + CSRF header) for tenant routes.
 */
export function e2eWorkflowApiClientCreate(options: E2eWorkflowApiClientCreateOptions) {
  const op = "e2eWorkflowApiClient"
  const baseUrl = options.baseUrl.replace(/\/+$/, "")
  const transport: E2eWorkflowApiFetch = options.fetch ?? fetch
  let cookie = ""

  const sessionCookieStore = (response: Response): void => {
    // Bun's fetch does not apply `Secure` cookies from http:// origins to its cookie jar, so the
    // E2E client maintains its own jar. Only the session and CSRF cookies matter; both must be
    // forwarded, so existing entries are preserved unless overwritten by name. Note both the
    // login response and the CSRF response set cookies via `set-cookie`; losing the session
    // cookie when storing the CSRF cookie breaks every subsequent call.
    const setCookies = response.headers.getSetCookie?.() ?? []
    const pairs = cookie.split(/;\s*/).filter((entry) => entry.length > 0)
    for (const header of setCookies) {
      const pair = header.split(";")[0] ?? ""
      if (pair.length === 0) continue
      const name = pair.split("=")[0] ?? ""
      if (name.length === 0 || (name !== "session" && name !== "csrf")) continue
      const kept = pairs.filter((candidate) => !candidate.startsWith(`${name}=`))
      pairs.length = 0
      pairs.push(...kept, pair)
    }
    cookie = pairs.join("; ")
  }

  const request = async <T>(
    path: string,
    init: RequestInit,
    schema: v.GenericSchema<T>,
    operation: string,
  ): Promise<T> => {
    const headers = new Headers(init.headers)
    headers.set("accept", "application/json")
    if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json")
    // Bun's fetch keeps its own cookie jar but drops `Secure` cookies from http:// origins, so
    // the E2E client maintains a manual jar and disables the built-in one per request.
    if (cookie.length > 0) headers.set("cookie", cookie)
    if (!headers.has("origin")) headers.set("origin", baseUrl)
    let response: Response
    try {
      response = await transport(`${baseUrl}${path}`, {
        ...init,
        credentials: "omit",
        headers,
      })
    } catch (error) {
      throw new Error(
        `${operation}: the server could not be reached at ${baseUrl}${path} (${error instanceof Error ? error.message : String(error)}).`,
      )
    }
    sessionCookieStore(response)
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new Error(`${operation}: the response from ${path} was not JSON (status ${response.status}).`)
    }
    if (!response.ok) {
      const message =
        typeof body === "object" && body !== null && "error" in body
          ? JSON.stringify((body as { error: unknown }).error)
          : `status ${response.status}`
      throw new Error(`${operation}: ${path} failed: ${message}`)
    }
    const parsed = v.safeParse(schema, body)
    if (!parsed.success) throw new Error(`${operation}: the response from ${path} did not validate.`)
    return parsed.output
  }

  const authenticated = <T>(
    session: E2eWorkflowApiSession,
    path: string,
    init: RequestInit,
    schema: v.GenericSchema<T>,
    operation: string,
  ): Promise<T> => {
    const prior = cookie
    cookie = session.cookie
    const headers = new Headers(init.headers)
    headers.set(sessionBrowserModeHeaderName, "true")
    headers.set("x-csrf-token", session.csrfToken)
    return request(path, { ...init, headers }, schema, operation).finally(() => {
      const updated = cookie
      cookie = prior
      void updated
    })
  }

  return {
    authenticated,
    authenticatedJson: async <T>(
      session: E2eWorkflowApiSession,
      method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT",
      path: string,
      input: unknown,
      schema: v.GenericSchema<T>,
      operation: string,
    ): Promise<T> =>
      authenticated(
        session,
        path,
        { body: input === undefined ? undefined : JSON.stringify(input), method },
        schema,
        operation,
      ),
    discovery: async (domain: string): Promise<{ readonly organizationId: string; readonly realmId: string }> => {
      const discovered = await request(
        `/organization-discovery?domain=${encodeURIComponent(domain)}`,
        { method: "GET" },
        v.looseObject({
          found: v.boolean(),
          organization: v.optional(v.looseObject({ id: v.string(), realmId: v.string() })),
        }),
        `${op}.discovery`,
      )
      if (!discovered.found || discovered.organization === undefined)
        throw new Error(`${op}.discovery: no realm serves the domain "${domain}".`)
      return { organizationId: discovered.organization.id, realmId: discovered.organization.realmId }
    },
    login: async (realmId: string, identifier: string, password: string): Promise<E2eWorkflowApiSession> => {
      const prior = cookie
      cookie = ""
      const headers = new Headers({ "content-type": "application/json" })
      headers.set(sessionBrowserModeHeaderName, "true")
      const loggedIn = await request(
        `/realms/${encodeURIComponent(realmId)}/password/login`,
        { body: JSON.stringify({ identifier, password }), headers, method: "POST" },
        passwordLoginResponseSchema,
        `${op}.login`,
      )
      const sessionCookie = cookie
      cookie = prior
      if (sessionCookie.length === 0) throw new Error(`${op}.login: the sign-in did not issue a session cookie.`)
      // The login response sets only the session cookie; the CSRF cookie is issued by the
      // `/sessions/csrf` endpoint below, which requires the session cookie. Forward both.
      cookie = sessionCookie
      const csrf = await request(
        `/realms/${encodeURIComponent(realmId)}/sessions/csrf`,
        { method: "GET" },
        sessionCsrfResponseSchema,
        `${op}.csrf`,
      )
      const withCsrf = cookie
      cookie = prior
      return { cookie: withCsrf, csrfToken: csrf.csrfToken, realmId, userId: loggedIn.authentication.userId }
    },
  }
}

export type E2eWorkflowApiClient = ReturnType<typeof e2eWorkflowApiClientCreate>
export type E2eWorkflowSession = E2eWorkflowApiSession
