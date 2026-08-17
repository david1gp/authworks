import { runtimeCreate } from "../runtime/runtimeCreate.js"

type Uuidv7Runtime = Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">

export function uuidv7Create(runtime: Uuidv7Runtime = runtimeCreate()): string {
  const timestamp = runtime.now()
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 0xffffffffffff) {
    throw new RangeError("UUIDv7 timestamps must be non-negative milliseconds within 48 bits.")
  }

  const bytes = runtime.randomBytes(16)
  if (bytes.length !== 16) throw new RangeError("UUIDv7 randomness must contain 16 bytes.")

  const timestampValue = BigInt(timestamp)
  for (let index = 0; index < 6; index += 1) {
    bytes[index] = Number((timestampValue >> BigInt((5 - index) * 8)) & 0xffn)
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
