import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { authworksConfigurationResolve } from "../../centralConfiguration/public/index.js"

type ConnectionProfileCliConnection = {
  readonly organizationId?: string
  readonly projectId?: string
  readonly realmId?: string
  readonly server: string
  readonly token?: string
}

type ConnectionProfileCliConnectionFlags = {
  readonly baseUrl?: string
  readonly envFile?: string
  readonly organizationId?: string
  readonly profile?: string
  readonly project?: string
  readonly projectId?: string
  readonly realmId?: string
  readonly server?: string
  readonly token?: string
  readonly url?: string
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
  const { path, ...configurationOptions } = options
  const resolved = await authworksConfigurationResolve({
    ...configurationOptions,
    ...(path === undefined ? {} : { legacyProfilesPath: path }),
    baseUrl: flags.baseUrl ?? flags.url ?? flags.server,
    envFile: flags.envFile,
    organizationId: flags.organizationId,
    profile: flags.profile,
    project: flags.project,
    projectId: flags.projectId,
    realmId: flags.realmId,
    token: flags.token,
  })
  if (!resolved.success) {
    if (flags.profile !== undefined && resolved.errorMessage === `Authworks profile "${flags.profile}" was not found.`)
      return resultErrorCreate(
        "connectionProfileCliConnectionResolve",
        `Connection profile "${flags.profile}" was not found.`,
      )
    return resolved
  }
  return resultCreate({
    server: resolved.data.baseUrl,
    ...(resolved.data.organizationId === undefined ? {} : { organizationId: resolved.data.organizationId }),
    ...(resolved.data.projectId === undefined ? {} : { projectId: resolved.data.projectId }),
    ...(resolved.data.realmId === undefined ? {} : { realmId: resolved.data.realmId }),
    ...(resolved.data.token === undefined ? {} : { token: resolved.data.token }),
  })
}
