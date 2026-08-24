import type { WahaSessionStatus } from "@adaptive-ds/waha-client"

export type WahaHealthPortSession = {
  readonly name: string
  readonly status: WahaSessionStatus
}
