import { readFile } from "node:fs/promises"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export type AuthworksDotenvEnvironmentLoadOptions = {
  readonly dotenv?: string
  readonly dotenvPath?: string
  readonly envFile?: string
  readonly envFilePath?: string
  readonly environment?: Readonly<Record<string, string | undefined>>
}

export async function authworksDotenvEnvironmentLoad(
  options: AuthworksDotenvEnvironmentLoadOptions = {},
): Promise<Result<Readonly<Record<string, string>>>> {
  const environment = options.environment ?? process.env
  const path = authworksDotenvPathResolve(options, environment)
  if (path === undefined) return resultCreate({})

  let content: string
  try {
    content = await readFile(path, "utf8")
  } catch (_error) {
    return resultErrorCreate("authworksDotenvEnvironmentLoad", "The selected dotenv file could not be read.")
  }

  const values: Record<string, string> = {}
  for (const line of content.split(/\r?\n/u)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u.exec(line)
    if (match === null || match[1] === undefined) continue
    values[match[1]] = authworksDotenvValueNormalize(match[2] ?? "")
  }
  return resultCreate(values)
}

function authworksDotenvPathResolve(
  options: AuthworksDotenvEnvironmentLoadOptions,
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  return (
    authworksPathValueGet([options.dotenvPath, options.envFilePath, options.envFile, options.dotenv]) ??
    authworksEnvironmentValueGet(environment, ["AUTHWORKS_ENV_FILE", "AUTHWORKS_DOTENV_PATH"])
  )
}

function authworksDotenvValueNormalize(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const decoded: unknown = JSON.parse(trimmed)
      return typeof decoded === "string" ? decoded : trimmed.slice(1, -1)
    } catch (_error) {
      return trimmed.slice(1, -1)
    }
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1)
  return trimmed.replace(/\s+#.*$/u, "").trim()
}

function authworksEnvironmentValueGet(
  environment: Readonly<Record<string, string | undefined>>,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = environment[name]
    if (value !== undefined && value.length > 0) return value
  }
  return undefined
}

function authworksPathValueGet(values: readonly (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value.length > 0)
}
