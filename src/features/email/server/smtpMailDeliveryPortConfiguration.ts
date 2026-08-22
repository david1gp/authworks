export type SmtpMailDeliveryPortConfiguration = {
  readonly from: string
  readonly host: string
  readonly password: string
  readonly port: number
  readonly security: "plain" | "starttls" | "tls"
  readonly username: string
}
