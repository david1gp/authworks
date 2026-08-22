export type ImapMailReceivePortConfiguration = {
  readonly host: string
  readonly mailbox?: string
  readonly password: string
  readonly port: number
  readonly security: "plain" | "starttls" | "tls"
  readonly username: string
}
