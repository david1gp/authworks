import type { WahaHealthPortSession } from "./wahaHealthPortSession.js"

export type WahaHealthPortResult = {
  readonly sessions: readonly WahaHealthPortSession[]
  readonly status: "error" | "ok"
}
