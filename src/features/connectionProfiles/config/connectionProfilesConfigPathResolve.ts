import { homedir } from "node:os"
import { join } from "node:path"

export function connectionProfilesConfigPathResolve(
  options: {
    readonly environment?: Readonly<Record<string, string | undefined>>
    readonly homeDirectory?: string
  } = {},
): string {
  const environment = options.environment ?? process.env
  const configHome = environment.XDG_CONFIG_HOME
  const homeDirectory = options.homeDirectory ?? environment.HOME ?? homedir()
  return join(
    configHome && configHome.length > 0 ? configHome : join(homeDirectory, ".config"),
    "authworks",
    "profiles.json",
  )
}
