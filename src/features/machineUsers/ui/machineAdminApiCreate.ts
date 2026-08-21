import { machineUserApiClientCreate } from "../client/machineUserApiClientCreate.js"

type MachineAdminFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/**
 * Binds the browser machine-user client to same-origin cookie credentials. The CSRF token is
 * resolved per mutation so a rotated session never sends a stale token.
 */
export function machineAdminApiCreate(options: {
  readonly baseUrl: string
  readonly csrfToken?: string
  readonly fetch?: MachineAdminFetch
}) {
  const browserFetch: MachineAdminFetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, credentials: "same-origin" })

  return machineUserApiClientCreate({
    baseUrl: options.baseUrl,
    ...(options.csrfToken === undefined ? {} : { csrfToken: options.csrfToken }),
    fetch: browserFetch,
  })
}
