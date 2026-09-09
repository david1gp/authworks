import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import { oidcMultichatClientEnsure } from "./oidcMultichatClientEnsure.js"
import { oidcMultichatProductionRealmResolve } from "./oidcMultichatProductionRealmResolve.js"
import { oidcMultichatProductionSystemSecretGet } from "./oidcMultichatProductionSystemSecretGet.js"

const oidcMultichatProductionOrigin = "https://authworks.contentoren.de"

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function oidcMultichatProductionClientEnsure(options: {
  readonly credentialEnvelopeWrite: (envelope: string) => void
  readonly fetch?: ProductionFetch
  readonly homeDirectory: string
}): Promise<Result<{ readonly action: "created" | "updated" | "unchanged"; readonly realmId: string }>> {
  const op = "oidcMultichatProductionClientEnsure"
  const secret = await oidcMultichatProductionSystemSecretGet(options.homeDirectory)
  if (!secret.success) return secret
  const clientOptions = { baseUrl: oidcMultichatProductionOrigin, fetch: options.fetch, token: secret.data }
  const realm = await oidcMultichatProductionRealmResolve(realmApiClientCreate(clientOptions))
  if (!realm.success) return realm

  let credentialEnvelope: string | undefined
  const ensured = await oidcMultichatClientEnsure({
    api: oidcApiClientCreate(clientOptions),
    credentialHandoff: async (credentials) => {
      credentialEnvelope = JSON.stringify({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        kind: "authworks.multichat-production-oidc-credential",
        version: 1,
      })
      return resultCreate(undefined)
    },
    environment: "production",
    realmId: realm.data.id,
  })
  if (!ensured.success) return ensured
  if (ensured.data.action === "created" && credentialEnvelope === undefined)
    return resultErrorCodedCreate(
      op,
      "The new Multichat production credential envelope was not created.",
      "platform.internal",
    )
  if (ensured.data.action !== "created" && credentialEnvelope !== undefined)
    return resultErrorCodedCreate(
      op,
      "An unexpected Multichat production credential envelope was created.",
      "platform.internal",
    )
  if (credentialEnvelope !== undefined) {
    try {
      options.credentialEnvelopeWrite(credentialEnvelope)
    } catch (_error) {
      return resultErrorCodedCreate(
        op,
        "The new Multichat production credential could not be handed off.",
        "platform.internal",
      )
    }
  }
  return resultCreate({ action: ensured.data.action, realmId: realm.data.id })
}
