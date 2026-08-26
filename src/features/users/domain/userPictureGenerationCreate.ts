import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"

const generationByteLength = 16

export function userPictureGenerationCreate(
  runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes"> = runtimeCreate(),
): Result<string> {
  const op = "userPictureGenerationCreate"
  let bytes: Uint8Array
  try {
    bytes = runtime.randomBytes(generationByteLength)
  } catch (_error) {
    return resultErrorCreate(op, "The user picture generation could not be created.")
  }
  if (!(bytes instanceof Uint8Array) || bytes.length !== generationByteLength)
    return resultErrorCreate(op, "The user picture generation is invalid.")
  return resultCreate(Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""))
}
