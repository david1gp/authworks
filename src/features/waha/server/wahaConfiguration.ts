import type { WahaEndpointConfiguration } from "./wahaEndpointConfiguration.js"

export type WahaConfiguration = {
  readonly codeRedactionDisabled: boolean
  readonly endpoints: readonly WahaEndpointConfiguration[]
  readonly refreshIntervalMs: number
  readonly freshnessTtlMs: number
  readonly senderDailyLimit: number
  readonly senderHourlyLimit: number
}
