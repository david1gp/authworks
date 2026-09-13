import { join } from "node:path"
import {
  authworksConfigurationDirectoryPathResolve,
  type AuthworksConfigurationPathOptions,
} from "./authworksConfigurationDirectoryPathResolve.js"

export type AuthworksProjectPathOptions = AuthworksConfigurationPathOptions & {
  readonly path?: string
  readonly projectDirectory?: string
  readonly projectPath?: string
  readonly projectsDirectory?: string
}

export function authworksProjectPathResolve(project: string, options: AuthworksProjectPathOptions = {}): string {
  return (
    options.path ??
    options.projectPath ??
    join(
      options.projectDirectory ??
        options.projectsDirectory ??
        join(authworksConfigurationDirectoryPathResolve(options), "projects"),
      `${project}.json`,
    )
  )
}
