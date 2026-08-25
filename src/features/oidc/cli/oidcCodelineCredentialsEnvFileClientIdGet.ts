import { access, constants, lstat, readFile } from "node:fs/promises"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const oidcCodelineClientIdEnvironmentNames = ["OIDC_CLIENT_ID", "ZITADEL_CLIENT_ID"] as const

export async function oidcCodelineCredentialsEnvFileClientIdGet(
  path: string,
): Promise<Result<{ readonly clientId?: string }>> {
  const op = "oidcCodelineCredentialsEnvFileClientIdGet"
  try {
    const file = await lstat(path)
    if (!file.isFile() || file.isSymbolicLink())
      return resultErrorCodedCreate(op, "The Codeline environment file must be a regular file.", "platform.internal")
    if ((file.mode & 0o077) !== 0)
      return resultErrorCodedCreate(
        op,
        "The Codeline environment file must not be group or world accessible.",
        "platform.internal",
      )
    await access(path, constants.W_OK)
    const content = await readFile(path, "utf8")
    const values = oidcCodelineClientIdEnvironmentNames.flatMap((name) => {
      const value = environmentValueGet(content, name)
      return value === undefined || value.length === 0 ? [] : [value]
    })
    if (new Set(values).size > 1)
      return resultErrorCodedCreate(
        op,
        "The Codeline environment file contains conflicting OIDC client IDs.",
        "oidc.conflict",
      )
    return resultCreate(values.length === 0 ? {} : { clientId: values[0] })
  } catch (_error) {
    return resultErrorCodedCreate(op, "The Codeline environment file could not be read safely.", "platform.internal")
  }
}

function environmentValueGet(content: string, name: string): string | undefined {
  const expression = new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`, "m")
  const match = expression.exec(content)
  if (match === null) return undefined
  const value = match[1] ?? ""
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  )
    return value.slice(1, -1)
  return value
}
