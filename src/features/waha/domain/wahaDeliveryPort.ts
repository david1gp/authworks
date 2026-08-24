import type { Result } from "#result"

export type WahaDeliveryPort = {
  readonly sendText: (input: {
    readonly chatId: string
    readonly endpointId: string
    readonly sessionName: string
    readonly text: string
  }) => Promise<Result<void>>
}
