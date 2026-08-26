import { createHash } from "node:crypto"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function userPictureHashCreate(body: Uint8Array): Result<string> {
  const op = "userPictureHashCreate"
  if (!(body instanceof Uint8Array)) return resultErrorCreate(op, "The user picture bytes are invalid.")
  try {
    return resultCreate(createHash("sha256").update(body).digest("hex"))
  } catch (_error) {
    return resultErrorCreate(op, "The user picture hash could not be created.")
  }
}
