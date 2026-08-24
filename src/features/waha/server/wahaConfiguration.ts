import type { WahaEndpointConfiguration } from "./wahaEndpointConfiguration.js"

export type WahaConfiguration = {
  readonly endpoints: readonly WahaEndpointConfiguration[]
  readonly refreshIntervalMs: number
  readonly freshnessTtlMs: number
}
