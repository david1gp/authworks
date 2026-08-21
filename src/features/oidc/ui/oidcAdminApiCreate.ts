import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"

type OidcAdminFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Binds the browser OIDC and user clients to same-origin cookie credentials.
 * The CSRF token is resolved per mutation so a rotated session never sends a stale token.
 */
export function oidcAdminApiCreate(options: {
  readonly baseUrl: string
  readonly csrfToken?: string
  readonly fetch?: OidcAdminFetch
}) {
  const browserFetch: OidcAdminFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "same-origin" })

  return {
    oidc: oidcApiClientCreate({
      baseUrl: options.baseUrl,
      ...(options.csrfToken === undefined ? {} : { csrfToken: options.csrfToken }),
      fetch: browserFetch,
    }),
    // Consent administration only reads the user directory, so no CSRF token is needed here.
    users: userApiClientCreate({ baseUrl: options.baseUrl, fetch: browserFetch }),
  }
}
