import { randomBytesCreate } from "./randomBytesCreate.js"

type RuntimeOverrides = Partial<{
  monotonicNow: () => number
  now: () => number
  randomBytes: (length: number) => Uint8Array
}>

export function runtimeCreate(overrides: RuntimeOverrides = {}) {
  return {
    monotonicNow: () => performance.now(),
    now: () => Date.now(),
    randomBytes: randomBytesCreate,
    ...overrides,
  }
}
