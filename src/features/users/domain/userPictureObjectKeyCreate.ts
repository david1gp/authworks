import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { userNameNormalize } from "./userNameNormalize.js"

export function userPictureObjectKeyCreate(input: {
  readonly extension: "gif" | "jpg" | "png" | "webp"
  readonly generation: string
  readonly sha256: string
  readonly userName: string
}): Result<string> {
  const op = "userPictureObjectKeyCreate"
  const userName = userNameNormalize(input.userName)
  if (!userName.success) return userName
  if (userName.data.includes("/") || userName.data.includes("\\") || /[?#\r\n]/.test(userName.data))
    return resultErrorCreate(op, "The user name cannot be used in a picture key.")
  if (!/^[0-9a-f]{32}$/.test(input.generation)) return resultErrorCreate(op, "The user picture generation is invalid.")
  if (!/^[0-9a-f]{64}$/.test(input.sha256)) return resultErrorCreate(op, "The user picture hash is invalid.")
  if (!isPictureExtension(input.extension)) return resultErrorCreate(op, "The user picture extension is invalid.")
  return resultCreate(`user-pictures/${userName.data}_${input.generation}_${input.sha256}.${input.extension}`)
}

function isPictureExtension(value: string): value is "gif" | "jpg" | "png" | "webp" {
  return value === "gif" || value === "jpg" || value === "png" || value === "webp"
}
