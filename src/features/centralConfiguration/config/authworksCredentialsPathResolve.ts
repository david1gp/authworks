import { join } from "node:path"
import {
  authworksConfigurationDirectoryPathResolve,
  type AuthworksConfigurationPathOptions,
} from "./authworksConfigurationDirectoryPathResolve.js"

export type AuthworksCredentialsPathOptions = AuthworksConfigurationPathOptions & {
  readonly credentialsDirectory?: string
  readonly credentialsPath?: string
  readonly path?: string
}

export function authworksCredentialsPathResolve(
  profile: string,
  options: AuthworksCredentialsPathOptions = {},
): string {
  return (
    options.path ??
    options.credentialsPath ??
    join(
      options.credentialsDirectory ?? join(authworksConfigurationDirectoryPathResolve(options), "credentials"),
      `${profile}.json`,
    )
  )
}
