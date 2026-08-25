import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import { oidcCodelineClientEnsure } from "./oidcCodelineClientEnsure.js"
import { oidcCodelineProductionRealmResolve } from "./oidcCodelineProductionRealmResolve.js"
import { oidcCodelineProductionSystemSecretGet } from "./oidcCodelineProductionSystemSecretGet.js"

const productionOrigin = "https://authworks.contentoren.de"
const productionClientName = "Codeline preview"

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function oidcCodelineProductionClientEnsure(options: {
  readonly credentialEnvelopeWrite: (envelope: string) => void
  readonly fetch?: ProductionFetch
  readonly homeDirectory: string
}): Promise<Result<{ readonly action: "created" | "updated" | "unchanged"; readonly realmId: string }>> {
  const op = "oidcCodelineProductionClientEnsure"
  const secret = await oidcCodelineProductionSystemSecretGet(options.homeDirectory)
  if (!secret.success) return secret
  const realmApi = realmApiClientCreate({ baseUrl: productionOrigin, fetch: options.fetch, token: secret.data })
  const realm = await oidcCodelineProductionRealmResolve(realmApi)
  if (!realm.success) return realm

  let credentialEnvelope: string | undefined
  const ensured = await oidcCodelineClientEnsure({
    api: oidcApiClientCreate({ baseUrl: productionOrigin, fetch: options.fetch, token: secret.data }),
    credentialHandoff: async (credentials) => {
      credentialEnvelope = JSON.stringify({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        kind: "authworks.codeline-oidc-credential",
        version: 1,
      })
      return resultCreate(undefined)
    },
    name: productionClientName,
    realmId: realm.data.id,
  })
  if (!ensured.success) return ensured
  if (ensured.data.action === "created" && credentialEnvelope === undefined)
    return resultErrorCodedCreate(op, "The new credential envelope was not created.", "platform.internal")
  if (ensured.data.action !== "created" && credentialEnvelope !== undefined)
    return resultErrorCodedCreate(op, "An unexpected credential envelope was created.", "platform.internal")
  if (credentialEnvelope !== undefined) {
    try {
      options.credentialEnvelopeWrite(credentialEnvelope)
    } catch (_error) {
      return resultErrorCodedCreate(op, "The new credential envelope could not be handed off.", "platform.internal")
    }
  }
  return resultCreate({ action: ensured.data.action, realmId: realm.data.id })
}
