import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { ConnectionProfile } from "../model/connectionProfile.js"
import { connectionProfilesStoreCreate } from "../persistence/connectionProfilesStoreCreate.js"

type ConnectionProfileCliConnection = {
  readonly organizationId?: string
  readonly realmId?: string
  readonly server: string
  readonly token?: string
}

type ConnectionProfileCliConnectionFlags = {
  readonly organizationId?: string
  readonly profile?: string
  readonly realmId?: string
  readonly server?: string
  readonly token?: string
}

type ConnectionProfileCliConnectionResolveOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly homeDirectory?: string
  readonly path?: string
}

export async function connectionProfileCliConnectionResolve(
  flags: ConnectionProfileCliConnectionFlags,
  options: ConnectionProfileCliConnectionResolveOptions = {},
): Promise<Result<ConnectionProfileCliConnection>> {
  const profile = await connectionProfileCliSelectedProfileResolve(flags.profile, options)
  if (!profile.success) return profile

  const environment = options.environment ?? process.env
  return resultCreate({
    organizationId: flags.organizationId ?? environment.AUTHWORKS_ORGANIZATION_ID ?? profile.data?.organizationId,
    realmId: flags.realmId ?? environment.AUTHWORKS_REALM_ID ?? profile.data?.realmId,
    server: flags.server ?? environment.AUTHWORKS_URL ?? profile.data?.server ?? "http://127.0.0.1:3000",
    token: flags.token ?? environment.AUTHWORKS_TOKEN ?? profile.data?.token,
  })
}

async function connectionProfileCliSelectedProfileResolve(
  name: string | undefined,
  options: ConnectionProfileCliConnectionResolveOptions,
): Promise<Result<ConnectionProfile | undefined>> {
  const selectedName = name ?? "default"
  const profile = await connectionProfilesStoreCreate({
    environment: options.environment,
    homeDirectory: options.homeDirectory,
    path: options.path,
  }).connectionProfileGet(selectedName)
  if (!profile.success) return profile
  if (profile.data !== undefined || name === undefined) return profile
  return resultErrorCreate(
    "connectionProfileCliConnectionResolve",
    `Connection profile "${selectedName}" was not found.`,
  )
}
