import type { EmailGeneratorFooter } from "../public/emailGeneratorFooterSchema.js"

export type EmailGeneratorServerConfiguration = {
  readonly baseUrl: string
  readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  readonly footer: EmailGeneratorFooter
  readonly invitationSender?: {
    readonly email: string
    readonly name: string
  }
}
