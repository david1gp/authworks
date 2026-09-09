import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import { oidcMultichatClientSecretRotate } from "./oidcMultichatClientSecretRotate.js"
import { oidcMultichatProductionRealmResolve } from "./oidcMultichatProductionRealmResolve.js"
import { oidcMultichatProductionSystemSecretGet } from "./oidcMultichatProductionSystemSecretGet.js"

const oidcMultichatDevelopmentOrigin = "https://authworks.contentoren.de"

type DevelopmentFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function oidcMultichatDevelopmentSecretRotate(options: {
  readonly credentialEnvelopeWrite: (envelope: string) => void
  readonly fetch?: DevelopmentFetch
  readonly homeDirectory: string
}): Promise<Result<{ readonly clientId: string; readonly realmId: string }>> {
  const op = "oidcMultichatDevelopmentSecretRotate"
  const secret = await oidcMultichatProductionSystemSecretGet(options.homeDirectory)
  if (!secret.success) return secret
  const clientOptions = { baseUrl: oidcMultichatDevelopmentOrigin, fetch: options.fetch, token: secret.data }
  const realm = await oidcMultichatProductionRealmResolve(realmApiClientCreate(clientOptions))
  if (!realm.success) return realm

  let credentialEnvelope: string | undefined
  const rotated = await oidcMultichatClientSecretRotate({
    api: oidcApiClientCreate(clientOptions),
    credentialHandoff: async (credentials) => {
      credentialEnvelope = JSON.stringify({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        kind: "authworks.multichat-development-oidc-credential",
        version: 1,
      })
      return resultCreate(undefined)
    },
    environment: "development",
    realmId: realm.data.id,
  })
  if (!rotated.success) return rotated
  if (credentialEnvelope === undefined)
    return resultErrorCodedCreate(
      op,
      "The rotated Multichat development credential envelope was not created.",
      "platform.internal",
    )
  try {
    options.credentialEnvelopeWrite(credentialEnvelope)
  } catch (_error) {
    return resultErrorCodedCreate(
      op,
      "The rotated Multichat development credential could not be handed off.",
      "platform.internal",
    )
  }
  return resultCreate({ clientId: rotated.data.clientId, realmId: rotated.data.realmId })
}
