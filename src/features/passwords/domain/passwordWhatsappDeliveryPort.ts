import type { Result } from "#result"

export type PasswordWhatsappDeliveryPort = {
  readonly sendText: (input: { readonly phoneNumber: string; readonly text: string }) => Promise<Result<void>>
}
