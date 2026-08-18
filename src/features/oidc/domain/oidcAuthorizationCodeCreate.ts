import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { oidcBase64UrlEncode } from "./oidcBase64UrlEncode.js"

export function oidcAuthorizationCodeCreate(
  runtime: Pick<ReturnType<typeof runtimeCreate>, "randomBytes"> = runtimeCreate(),
): Result<string> {
  const op = "oidcAuthorizationCodeCreate"
  try {
    const bytes = runtime.randomBytes(32)
    if (bytes.length !== 32)
      return resultErrorCreate(op, "The authorization code could not be generated.", "oidc.write-failed")
    return resultCreate(oidcBase64UrlEncode(bytes))
  } catch (_error) {
    return resultErrorCreate(op, "The authorization code could not be generated.", "oidc.write-failed")
  }
}
