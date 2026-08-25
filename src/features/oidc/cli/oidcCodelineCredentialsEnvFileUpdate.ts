import { chmod, lstat, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"

const oidcCodelineCredentialEnvironmentNames = [
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "ZITADEL_CLIENT_ID",
  "ZITADEL_CLIENT_SECRET",
] as const

export async function oidcCodelineCredentialsEnvFileUpdate(options: {
  readonly clientId: string
  readonly clientSecret: string
  readonly path: string
}): Promise<Result<{ readonly aliases: readonly string[]; readonly path: string }>> {
  const op = "oidcCodelineCredentialsEnvFileUpdate"
  let temporaryPath: string | undefined
  try {
    const file = await lstat(options.path)
    if (!file.isFile() || file.isSymbolicLink())
      return resultErrorCodedCreate(op, "The Codeline environment file must be a regular file.", "platform.internal")
    if ((file.mode & 0o077) !== 0)
      return resultErrorCodedCreate(
        op,
        "The Codeline environment file must not be group or world accessible.",
        "platform.internal",
      )
    const content = await readFile(options.path, "utf8")
    const updated = environmentFileUpdate(content, options.clientId, options.clientSecret)
    temporaryPath = `${options.path}.${process.pid}.${crypto.randomUUID()}.tmp`
    await writeFile(temporaryPath, updated, { encoding: "utf8", flag: "wx", mode: 0o600 })
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, options.path)
    temporaryPath = undefined
    return resultCreate({ aliases: oidcCodelineCredentialEnvironmentNames, path: options.path })
  } catch (_error) {
    return resultErrorCodedCreate(
      op,
      "The Codeline OIDC credentials could not be stored atomically.",
      "platform.internal",
    )
  } finally {
    if (temporaryPath !== undefined) await unlink(temporaryPath).catch(() => undefined)
  }
}

function environmentFileUpdate(content: string, clientId: string, clientSecret: string): string {
  const newline = content.includes("\r\n") ? "\r\n" : "\n"
  const trailingNewline = content.endsWith("\n")
  const lines = content.split(/\r?\n/)
  if (trailingNewline) lines.pop()
  const values = new Map<string, string>([
    ["OIDC_CLIENT_ID", clientId],
    ["OIDC_CLIENT_SECRET", clientSecret],
    ["ZITADEL_CLIENT_ID", clientId],
    ["ZITADEL_CLIENT_SECRET", clientSecret],
  ])
  const present = new Set<string>()
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const match = /^\s*(OIDC_CLIENT_ID|OIDC_CLIENT_SECRET|ZITADEL_CLIENT_ID|ZITADEL_CLIENT_SECRET)\s*=/.exec(line)
    if (match === null) continue
    const name = match[1]
    if (name === undefined) continue
    const value = values.get(name)
    if (value === undefined) continue
    lines[index] = `${name}=${value}`
    present.add(name)
  }
  for (const name of oidcCodelineCredentialEnvironmentNames) {
    if (!present.has(name)) lines.push(`${name}=${values.get(name) ?? ""}`)
  }
  const result = lines.join(newline)
  return trailingNewline || present.size !== oidcCodelineCredentialEnvironmentNames.length
    ? `${result}${newline}`
    : result
}
