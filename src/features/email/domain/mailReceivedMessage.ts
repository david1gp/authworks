export type MailReceivedMessage = {
  readonly from: readonly string[]
  readonly source: string
  readonly subject: string | undefined
  readonly to: readonly string[]
  readonly uid: number
}
