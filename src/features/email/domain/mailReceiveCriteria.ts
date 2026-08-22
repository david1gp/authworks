export type MailReceiveCriteria = {
  readonly limit?: number
  readonly pollIntervalMs?: number
  readonly subjectContains?: string
  readonly timeoutMs?: number
  readonly to?: string
}
