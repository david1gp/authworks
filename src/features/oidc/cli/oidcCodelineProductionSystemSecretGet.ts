import { constants } from "node:fs"
import { type FileHandle, open } from "node:fs/promises"
import { join } from "node:path"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { Secret } from "../../../platform/secrets/Secret.js"

export async function oidcCodelineProductionSystemSecretGet(homeDirectory: string): Promise<Result<Secret>> {
  const op = "oidcCodelineProductionSystemSecretGet"
  const uid = process.getuid?.()
  if (uid === undefined)
    return resultErrorCodedCreate(
      op,
      "The production Authworks environment owner cannot be verified.",
      "platform.internal",
    )
  const handles: FileHandle[] = []
  try {
    const homeComponents = homeDirectory.split("/").filter(Boolean)
    if (!homeDirectory.startsWith("/") || homeComponents.some((component) => component === "." || component === ".."))
      return resultErrorCodedCreate(op, "The production Authworks home path is invalid.", "platform.internal")
    let directory = await open("/", constants.O_RDONLY | constants.O_DIRECTORY)
    handles.push(directory)
    for (const name of homeComponents) {
      directory = await open(
        join("/proc/self/fd", String(directory.fd), name),
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      )
      handles.push(directory)
    }
    for (const name of [".config", "authworks"]) {
      const metadata = await directory.stat()
      if (!metadata.isDirectory() || metadata.uid !== uid || (metadata.mode & 0o022) !== 0)
        return resultErrorCodedCreate(
          op,
          "The production Authworks environment path is not protected.",
          "platform.internal",
        )
      directory = await open(
        join("/proc/self/fd", String(directory.fd), name),
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      )
      handles.push(directory)
    }
    const directoryMetadata = await directory.stat()
    if (!directoryMetadata.isDirectory() || directoryMetadata.uid !== uid || (directoryMetadata.mode & 0o022) !== 0)
      return resultErrorCodedCreate(
        op,
        "The production Authworks environment path is not protected.",
        "platform.internal",
      )
    const environment = await open(
      join("/proc/self/fd", String(directory.fd), "authworks.env"),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    )
    handles.push(environment)
    const file = await environment.stat()
    if (!file.isFile() || file.uid !== uid || (file.mode & 0o077) !== 0 || file.size > 1024 * 1024)
      return resultErrorCodedCreate(
        op,
        "The production Authworks environment file is not owner-only.",
        "platform.internal",
      )
    const content = await environment.readFile("utf8")
    const values = content
      .split(/\r?\n/)
      .map((line) => /^AUTHWORKS_SYSTEM_SECRET=(.*)$/.exec(line)?.[1])
      .filter((value): value is string => value !== undefined)
    if (values.length !== 1 || !/^[A-Za-z0-9_-]{32,512}$/.test(values[0] ?? ""))
      return resultErrorCodedCreate(
        op,
        "The production Authworks environment must contain one unambiguous system secret.",
        "platform.internal",
      )
    return resultCreate(new Secret(values[0] ?? ""))
  } catch (_error) {
    return resultErrorCodedCreate(op, "The production Authworks environment could not be read.", "platform.internal")
  } finally {
    await Promise.all(handles.map(async (handle) => await handle.close().catch(() => undefined)))
  }
}
