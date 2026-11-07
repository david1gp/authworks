import type { Result } from "#result"

export type PasswordWhatsappDeliveryPort = {
  readonly sendText: (input: {
    readonly phoneNumber: string
    readonly purpose?: string
    readonly realmId?: string
    readonly text: string
  }) => Promise<Result<void>>
}
