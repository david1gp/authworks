import type { Result } from "#result"

export type WahaTextDeliveryPort = {
  readonly sendText: (input: { readonly phoneNumber: string; readonly text: string }) => Promise<Result<void>>
}
