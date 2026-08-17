export function randomBytesCreate(length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError("Random byte length must be a non-negative safe integer.")
  }

  return crypto.getRandomValues(new Uint8Array(length))
}
