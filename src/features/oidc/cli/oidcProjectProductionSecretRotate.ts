import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import { oidcProjectBoundaryRegistry } from "./oidcProjectBoundaryRegistry.js"
import { oidcProjectClientSecretRotate } from "./oidcProjectClientSecretRotate.js"
import { oidcMultichatProductionRealmResolve } from "./oidcMultichatProductionRealmResolve.js"
import { oidcMultichatProductionSystemSecretGet } from "./oidcMultichatProductionSystemSecretGet.js"

const oidcProjectProductionOrigin = "https://authworks.contentoren.de"

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function oidcProjectProductionSecretRotate(options: {
  readonly credentialEnvelopeWrite: (envelope: string) => void
  readonly fetch?: ProductionFetch
  readonly homeDirectory: string
  readonly project: string
}): Promise<Result<{ readonly clientId: string; readonly realmId: string }>> {
  const op = "oidcProjectProductionSecretRotate"
  const project = oidcProjectBoundaryRegistry[options.project]
  if (project === undefined)
    return resultErrorCodedCreate(
      op,
      `Unknown project boundary "${options.project}"; no changes were made.`,
      "platform.internal",
    )
  const secret = await oidcMultichatProductionSystemSecretGet(options.homeDirectory)
  if (!secret.success) return secret
  const clientOptions = { baseUrl: oidcProjectProductionOrigin, fetch: options.fetch, token: secret.data }
  const realm = await oidcMultichatProductionRealmResolve(realmApiClientCreate(clientOptions))
  if (!realm.success) return realm

  let credentialEnvelope: string | undefined
  const rotated = await oidcProjectClientSecretRotate({
    api: oidcApiClientCreate(clientOptions),
    credentialHandoff: async (credentials) => {
      credentialEnvelope = JSON.stringify({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        kind: `authworks.${project.slug}-production-oidc-credential`,
        version: 1,
      })
      return resultCreate(undefined)
    },
    environment: "production",
    project,
    realmId: realm.data.id,
  })
  if (!rotated.success) return rotated
  if (credentialEnvelope === undefined)
    return resultErrorCodedCreate(
      op,
      `The rotated ${project.displayName} production credential envelope was not created.`,
      "platform.internal",
    )
  try {
    options.credentialEnvelopeWrite(credentialEnvelope)
  } catch (_error) {
    return resultErrorCodedCreate(
      op,
      `The rotated ${project.displayName} production credential could not be handed off.`,
      "platform.internal",
    )
  }
  return resultCreate({ clientId: rotated.data.clientId, realmId: rotated.data.realmId })
}
