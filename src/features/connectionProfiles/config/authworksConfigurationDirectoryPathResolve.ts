import { homedir } from "node:os"
import { join } from "node:path"

export type AuthworksConfigurationPathOptions = {
  readonly configDirectory?: string
  readonly configurationDirectory?: string
  readonly directory?: string
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly homeDirectory?: string
  readonly rootDirectory?: string
}

export function authworksConfigurationDirectoryPathResolve(options: AuthworksConfigurationPathOptions = {}): string {
  const explicitDirectory =
    options.directory ?? options.configDirectory ?? options.configurationDirectory ?? options.rootDirectory
  if (explicitDirectory !== undefined) return explicitDirectory

  const environment = options.environment ?? process.env
  const configHome = environment.XDG_CONFIG_HOME
  const homeDirectory = options.homeDirectory || environment.HOME || homedir()
  return join(configHome && configHome.length > 0 ? configHome : join(homeDirectory, ".config"), "authworks")
}
