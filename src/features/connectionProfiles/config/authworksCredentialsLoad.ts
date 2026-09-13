import { O_NOFOLLOW, O_RDONLY } from "node:constants"
import { chmod, open } from "node:fs/promises"
import { dirname } from "node:path"
import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { connectionProfileNameValidate } from "../model/connectionProfileNameValidate.js"
import {
  type AuthworksCredentialsPathOptions,
  authworksCredentialsPathResolve,
} from "./authworksCredentialsPathResolve.js"
import { type AuthworksCredentials, authworksCredentialsSchema } from "./authworksCredentialsSchema.js"

export type AuthworksCredentialsLoadOptions = AuthworksCredentialsPathOptions

export async function authworksCredentialsLoad(
  profile: string,
  options: AuthworksCredentialsLoadOptions = {},
): Promise<Result<AuthworksCredentials>> {
  const op = "authworksCredentialsLoad"
  const validProfile = connectionProfileNameValidate(profile)
  if (!validProfile.success) return validProfile

  const path = authworksCredentialsPathResolve(validProfile.data, options)
  let fileHandle: Awaited<ReturnType<typeof open>> | undefined
  let content: string
  try {
    await chmod(dirname(path), 0o700)
    fileHandle = await open(path, O_RDONLY | O_NOFOLLOW)
    const file = await fileHandle.stat()
    if (!file.isFile()) return resultErrorCreate(op, "The Authworks credentials file must be a regular file.")
    await fileHandle.chmod(0o600)
    content = await fileHandle.readFile("utf8")
  } catch (error) {
    if (isFileMissing(error)) {
      try {
        await chmod(dirname(path), 0o700)
      } catch (directoryError) {
        if (!isFileMissing(directoryError))
          return resultErrorCreate(op, "The Authworks credentials could not be read safely.")
      }
      return resultCreate({ testUsers: {} })
    }
    return resultErrorCreate(op, "The Authworks credentials could not be read safely.")
  } finally {
    await fileHandle?.close().catch(() => undefined)
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(content)
  } catch (_error) {
    return resultErrorCreate(op, "The Authworks credentials file is malformed.")
  }

  const parsed = v.safeParse(authworksCredentialsSchema, decoded)
  if (!parsed.success) return resultErrorCreate(op, "The Authworks credentials file is invalid.")
  return resultCreate(parsed.output)
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}
