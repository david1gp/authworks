import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { oidcBase64UrlEncode } from "./oidcBase64UrlEncode.js"

export function oidcRefreshTokenCreate(
  runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes"> = runtimeCreate(),
): Result<string> {
  const op = "oidcRefreshTokenCreate"
  try {
    const bytes = runtime.randomBytes(32)
    if (bytes.length !== 32) return resultErrorCreate(op, "The refresh token could not be generated.")
    return resultCreate(oidcBase64UrlEncode(bytes))
  } catch (_error) {
    return resultErrorCreate(op, "The refresh token could not be generated.")
  }
}
