import { scryptSync, timingSafeEqual } from "node:crypto"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"

export function passwordHashVerify(password: string, encoded: string): Result<boolean> {
  const op = "passwordHashVerify"
  try {
    const parts = encoded.split("$")
    if (parts.length !== 6 || parts[0] !== "scrypt") return resultCreate(false)
    const n = Number(parts[1])
    const r = Number(parts[2])
    const p = Number(parts[3])
    const salt = Buffer.from(parts[4] ?? "", "base64url")
    const expected = Buffer.from(parts[5] ?? "", "base64url")
    if (n !== 16_384 || r !== 8 || p !== 1 || salt.length !== 16 || expected.length !== 32) return resultCreate(false)
    const actual = Buffer.from(scryptSync(password, salt, 32, { maxmem: 32 * 1024 * 1024, N: n, p, r }))
    return resultCreate(timingSafeEqual(actual, expected))
  } catch (_error) {
    return resultErrorCreate(op, "The password could not be verified.")
  }
}
