import { runtimeCreate } from "../runtime/runtimeCreate.js"

type PlatformTestkitOptions = Partial<{
  now: number
  randomByte: number
}>

export function platformTestkitCreate(options: PlatformTestkitOptions = {}) {
  let now = options.now ?? 1_700_000_000_000
  let randomByte = options.randomByte ?? 0
  const runtime = runtimeCreate({
    monotonicNow: () => now,
    now: () => now,
    randomBytes: (length) => {
      const bytes = new Uint8Array(length)
      bytes.fill(randomByte)
      randomByte = (randomByte + 1) & 0xff
      return bytes
    },
  })

  return {
    advance: (milliseconds: number) => {
      now += milliseconds
    },
    runtime,
    setNow: (milliseconds: number) => {
      now = milliseconds
    },
  }
}
