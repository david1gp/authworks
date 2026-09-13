import { join } from "node:path"
import {
  authworksConfigurationDirectoryPathResolve,
  type AuthworksConfigurationPathOptions,
} from "./authworksConfigurationDirectoryPathResolve.js"

export type AuthworksConfigurationFilePathOptions = AuthworksConfigurationPathOptions & {
  readonly configPath?: string
  readonly configurationPath?: string
  readonly path?: string
}

export function authworksConfigurationPathResolve(options: AuthworksConfigurationFilePathOptions = {}): string {
  return (
    options.path ??
    options.configPath ??
    options.configurationPath ??
    join(authworksConfigurationDirectoryPathResolve(options), "config.json")
  )
}
