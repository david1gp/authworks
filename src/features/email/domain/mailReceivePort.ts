import type { Result } from "#result"
import type { MailReceiveCriteria } from "./mailReceiveCriteria.js"
import type { MailReceivedMessage } from "./mailReceivedMessage.js"

export type MailReceivePort = {
  readonly receive: (criteria?: MailReceiveCriteria) => Promise<Result<readonly MailReceivedMessage[]>>
}
