import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import { projectApiClientCreate } from "../client/projectApiClientCreate.js"

type ProjectAdminFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Binds the browser project and organization clients to same-origin cookie credentials.
 * The CSRF token is resolved per mutation so a rotated session never sends a stale token.
 */
export function projectAdminApiCreate(options: {
  readonly baseUrl: string
  readonly csrfToken?: string
  readonly fetch?: ProjectAdminFetch
}) {
  const browserFetch: ProjectAdminFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "same-origin" })

  return {
    organizations: organizationApiClientCreate({
      baseUrl: options.baseUrl,
      ...(options.csrfToken === undefined ? {} : { csrfToken: options.csrfToken }),
      fetch: browserFetch,
    }),
    projects: projectApiClientCreate({
      baseUrl: options.baseUrl,
      ...(options.csrfToken === undefined ? {} : { csrfToken: options.csrfToken }),
      fetch: browserFetch,
    }),
  }
}
