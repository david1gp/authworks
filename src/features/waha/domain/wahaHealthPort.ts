import type { Result } from "#result"
import type { WahaHealthPortResult } from "./wahaHealthPortResult.js"

export type WahaHealthPort = {
  readonly check: (input: { readonly endpointId: string }) => Promise<Result<WahaHealthPortResult>>
}
