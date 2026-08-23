import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import { sessionApiClientCreate } from "../../sessions/client/sessionApiClientCreate.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import { impersonationApiClientCreate } from "../client/impersonationApiClientCreate.js"

type ImpersonationAdminFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Binds the completed impersonation, session, user, and organization browser clients to
 * same-origin cookie credentials. No bearer token is ever supplied from the browser.
 */
export function impersonationAdminApiCreate(options: {
  readonly baseUrl: string
  readonly csrfToken?: string
  readonly fetch?: ImpersonationAdminFetch
}) {
  const browserFetch: ImpersonationAdminFetch = (input, init) => {
    const headers = new Headers(init?.headers)
    if (options.csrfToken !== undefined) headers.set("x-csrf-token", options.csrfToken)
    return (options.fetch ?? fetch)(input, { ...init, credentials: "same-origin", headers })
  }

  return {
    impersonation: impersonationApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    organizations: organizationApiClientCreate({
      baseUrl: options.baseUrl,
      ...(options.csrfToken === undefined ? {} : { csrfToken: options.csrfToken }),
      fetch: browserFetch,
    }),
    sessions: sessionApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
    users: userApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
  }
}
