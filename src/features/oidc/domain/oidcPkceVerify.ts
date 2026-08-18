import { timingSafeEqual } from "node:crypto"
import { createHash } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcBase64UrlEncode } from "./oidcBase64UrlEncode.js"

export function oidcPkceVerify(verifier: string, challenge: string, method: string): Result<boolean> {
  const op = "oidcPkceVerify"
  if (method !== "S256" || verifier.length < 43 || verifier.length > 128 || !/^[A-Za-z0-9._~-]+$/.test(verifier))
    return resultErrorCreate(op, "The PKCE verifier is invalid.", "oidc.invalid")
  if (!/^[A-Za-z0-9_-]+$/.test(challenge) || challenge.length !== 43)
    return resultErrorCreate(op, "The PKCE challenge is invalid.", "oidc.invalid")
  const actual = Buffer.from(oidcBase64UrlEncode(createHash("sha256").update(verifier, "utf8").digest()), "utf8")
  const expected = Buffer.from(challenge, "utf8")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return resultErrorCreate(op, "The PKCE verifier is invalid.", "oidc.invalid")
  return resultCreate(true)
}
