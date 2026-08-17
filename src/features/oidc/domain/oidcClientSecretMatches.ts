import { timingSafeEqual } from "node:crypto"
import { oidcSecretHashCreate } from "./oidcSecretHashCreate.js"

export function oidcClientSecretMatches(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(oidcSecretHashCreate(secret), "utf8")
  const expected = Buffer.from(expectedHash, "utf8")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
