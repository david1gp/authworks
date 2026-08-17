import { Secret } from "./Secret.js"

export function secretMatches(actual: Secret | string, expected: Secret | string): boolean {
  const actualBytes = new TextEncoder().encode(actual instanceof Secret ? actual.valueGet() : actual)
  const expectedBytes = new TextEncoder().encode(expected instanceof Secret ? expected.valueGet() : expected)
  const length = Math.max(actualBytes.length, expectedBytes.length)
  let difference = actualBytes.length ^ expectedBytes.length

  for (let index = 0; index < length; index += 1) {
    difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0)
  }

  return difference === 0
}
