import { secretMatches } from "../../../platform/secrets/secretMatches.js"

const csrfTokenPattern = /^[A-Za-z0-9_-]{43}$/

export function sessionCsrfTokenValidate(
  actual: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (actual === null || actual === undefined || expected === null || expected === undefined) return false
  if (!csrfTokenPattern.test(actual) || !csrfTokenPattern.test(expected)) return false
  return secretMatches(actual, expected)
}
