import type { OidcClient } from "../public/oidcClientSchema.js"
import type { OidcAdminIssuedSecret } from "./oidcAdminIssuedSecret.js"

/**
 * Chooses which client a directly linked one-time demo secret belongs to. A client detail
 * deep link seeds that client, so the panel never shows another client's identity, and an
 * unknown identifier seeds nothing at all.
 */
export function oidcAdminDemoIssuedSecretSeedSelect(options: {
  readonly clientId: string | undefined
  readonly clients: readonly OidcClient[]
  readonly secret: string
}): OidcAdminIssuedSecret | undefined {
  const selected =
    options.clientId === undefined ? options.clients[0] : options.clients.find((item) => item.id === options.clientId)
  if (selected === undefined) return undefined
  return { clientId: selected.id, clientName: selected.name, kind: "rotated", secret: options.secret }
}
