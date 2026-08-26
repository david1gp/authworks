import type { WahaClientConfig } from "@adaptive-ds/waha-client"

export type WahaEndpointConfiguration = {
  readonly id: string
  readonly client: WahaClientConfig
  readonly senderSessions?: readonly string[]
}
