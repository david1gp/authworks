import { type FetchMessageObject, ImapFlow, type ImapFlowOptions, type MessageAddressObject } from "imapflow"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { MailReceiveCriteria } from "../domain/mailReceiveCriteria.js"
import type { MailReceivedMessage } from "../domain/mailReceivedMessage.js"
import type { MailReceivePort } from "../domain/mailReceivePort.js"
import type { ImapMailReceivePortConfiguration } from "./imapMailReceivePortConfiguration.js"

type ImapClient = Pick<ImapFlow, "close" | "connect" | "fetchAll" | "getMailboxLock" | "logout" | "search">

type ImapMailReceivePortCreateOptions = ImapMailReceivePortConfiguration & {
  readonly client?: ImapClient
}

export function imapMailReceivePortCreate(options: ImapMailReceivePortCreateOptions): MailReceivePort {
  const clientOptions: ImapFlowOptions = {
    auth: { pass: options.password, user: options.username },
    disableAutoIdle: true,
    doSTARTTLS: options.security === "starttls",
    host: options.host,
    logger: false,
    port: options.port,
    secure: options.security === "tls",
  }
  const createClient = () => options.client ?? new ImapFlow(clientOptions)

  return {
    async receive(criteria: MailReceiveCriteria = {}) {
      const op = "imapMailReceivePortReceive"
      const client = createClient()
      const timeoutMs = positiveIntegerResolve(criteria.timeoutMs, 30_000)
      const pollIntervalMs = positiveIntegerResolve(criteria.pollIntervalMs, 1_000)
      const limit = positiveIntegerResolve(criteria.limit, 50)
      const deadline = Date.now() + timeoutMs
      let connected = false
      try {
        await client.connect()
        connected = true
        while (true) {
          const messages = await imapMessagesRead(client, options.mailbox ?? "INBOX", criteria, limit)
          if (messages.length > 0) return resultCreate(messages)
          if (Date.now() >= deadline) return resultCreate([])
          await sleep(pollIntervalMs)
        }
      } catch (_error) {
        return resultErrorCreate(op, "IMAP receive failed.")
      } finally {
        if (connected) {
          await client.logout().catch(() => client.close())
        } else {
          client.close()
        }
      }
    },
  }
}

async function imapMessagesRead(
  client: ImapClient,
  mailbox: string,
  criteria: MailReceiveCriteria,
  limit: number,
): Promise<readonly MailReceivedMessage[]> {
  const lock = await client.getMailboxLock(mailbox)
  try {
    const searched = await client.search(
      {
        all: true,
        ...(criteria.subjectContains === undefined ? {} : { subject: criteria.subjectContains }),
        ...(criteria.to === undefined ? {} : { to: criteria.to }),
      },
      { uid: true },
    )
    if (searched === false || searched.length === 0) return []
    const fetched = await client.fetchAll(searched.slice(-limit), { envelope: true, source: true }, { uid: true })
    return fetched
      .filter((message): message is FetchMessageObject & { source: Buffer } => message.source !== undefined)
      .map(mailReceivedMessageCreate)
      .filter((message) => mailReceivedMessageMatches(message, criteria))
  } finally {
    lock.release()
  }
}

function mailReceivedMessageCreate(message: FetchMessageObject): MailReceivedMessage {
  return {
    from: mailAddressListCreate(message.envelope?.from),
    source: message.source?.toString("utf8") ?? "",
    subject: message.envelope?.subject,
    to: mailAddressListCreate(message.envelope?.to),
    uid: message.uid,
  }
}

function mailAddressListCreate(addresses: readonly MessageAddressObject[] | undefined): readonly string[] {
  return (addresses ?? []).map((address) => address.address ?? "").filter((address) => address.length > 0)
}

function mailReceivedMessageMatches(message: MailReceivedMessage, criteria: MailReceiveCriteria): boolean {
  if (
    criteria.subjectContains !== undefined &&
    !message.subject?.toLowerCase().includes(criteria.subjectContains.toLowerCase())
  )
    return false
  if (criteria.to !== undefined && !message.to.some((address) => address.toLowerCase() === criteria.to?.toLowerCase()))
    return false
  return true
}

function positiveIntegerResolve(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
