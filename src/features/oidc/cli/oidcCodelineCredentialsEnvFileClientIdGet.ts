import { access, constants, lstat, readFile } from "node:fs/promises"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const oidcCodelineClientIdEnvironmentNames = [
  "OIDC_AUTHWORKS_CLIENT_ID",
  "OIDC_CLIENT_ID",
  "ZITADEL_CLIENT_ID",
] as const

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
    const valuesByName = new Map<string, string>()
    for (const entry of environmentEntriesGet(content)) {
      if (valuesByName.has(entry.name))
        return resultErrorCodedCreate(
          op,
          "The Codeline environment file contains duplicate credential aliases.",
          "oidc.conflict",
        )
      valuesByName.set(entry.name, environmentValueNormalize(entry.value))
    }
    const values = oidcCodelineClientIdEnvironmentNames.flatMap((name) => {
      const value = valuesByName.get(name)
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

function environmentEntriesGet(content: string): Array<{ readonly name: string; readonly value: string }> {
  const entries: Array<{ readonly name: string; readonly value: string }> = []
  for (const line of content.split(/\r?\n/)) {
    const match =
      /^[ \t]*(OIDC_AUTHWORKS_CLIENT_ID|OIDC_AUTHWORKS_CLIENT_SECRET|OIDC_CLIENT_ID|OIDC_CLIENT_SECRET|ZITADEL_CLIENT_ID|ZITADEL_CLIENT_SECRET)[ \t]*=(.*)$/.exec(
        line,
      )
    if (match === null || match[1] === undefined) continue
    entries.push({ name: match[1], value: match[2] ?? "" })
  }
  return entries
}

function environmentValueNormalize(rawValue: string): string {
  const value = rawValue.trim()
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  )
    return value.slice(1, -1)
  return value
}
