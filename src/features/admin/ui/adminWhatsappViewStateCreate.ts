import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AuthenticatedStatusTone } from "../../../ui/authenticated/authenticatedStatusTone.js"
import type { WhatsappOtpUsageQuery } from "../../whatsappOtp/public/whatsappOtpUsageQuerySchema.js"
import type { WhatsappOtpUsageResponse } from "../../whatsappOtp/public/whatsappOtpUsageResponseSchema.js"

type WhatsappQuotaWindow = {
  readonly barLabel: string
  readonly limit: number
  readonly line: string
  readonly percent: number
  readonly sent: number
  readonly width: string
  readonly windowLabel: string
}

export type WhatsappSenderCard = {
  readonly dimmed: boolean
  readonly endpointId: string
  readonly healthLabel: string
  readonly healthTone: AuthenticatedStatusTone
  readonly sessionName: string
  readonly day: WhatsappQuotaWindow
  readonly hour: WhatsappQuotaWindow
}

export type WhatsappPurposeEntry = {
  readonly count: number
  readonly name: string
}

export type WhatsappRecentStatus = {
  readonly label: string
  readonly tone: AuthenticatedStatusTone
}

type WhatsappRecentEntry = WhatsappOtpUsageResponse["recent"][number]

export type WhatsappRecentRow = Pick<
  WhatsappRecentEntry,
  "createdAt" | "endpointId" | "purpose" | "sessionName" | "status"
> & {
  readonly code: string
  /** Full phone number, with the hash prefix as the pre-Phase-2 fallback display. */
  readonly phone: string
}

export type WhatsappWindowOption = {
  readonly label: string
  readonly selected: boolean
  readonly value: WhatsappOtpUsageQuery["window"]
}

/** Clamps a quota fill ratio to 0–100; an exhausted or missing limit renders full. */
function whatsappQuotaPercent(sent: number, limit: number): number {
  if (limit <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((sent / limit) * 100)))
}

function whatsappQuotaWindowCreate(
  senderName: string,
  sent: number,
  limit: number,
  windowLabel: string,
): WhatsappQuotaWindow {
  const remaining = Math.max(0, limit - sent)
  return {
    barLabel: messageTranslate("admin.whatsapp.quotaBarLabel", { sender: senderName, window: windowLabel }),
    limit,
    line: messageTranslate("admin.whatsapp.quotaLine", { left: remaining, limit, sent }),
    percent: whatsappQuotaPercent(sent, limit),
    sent,
    width: `${whatsappQuotaPercent(sent, limit)}%`,
    windowLabel,
  }
}

function whatsappRecentStatusGet(status: "sent" | "failed" | "blocked"): WhatsappRecentStatus {
  if (status === "failed") return { label: messageTranslate("admin.whatsapp.statusFailed"), tone: "danger" }
  if (status === "blocked") return { label: messageTranslate("admin.whatsapp.statusBlocked"), tone: "warning" }
  return { label: messageTranslate("admin.whatsapp.statusSent"), tone: "success" }
}

/** Derives every WhatsApp usage presentation value from the loaded usage response. */
export function adminWhatsappViewStateCreate(options: {
  readonly usage: () => WhatsappOtpUsageResponse | undefined
  /** Current recent-activity window; defaults to 24h for callers without a selector (realm tile). */
  readonly window?: () => WhatsappOtpUsageQuery["window"]
}) {
  const usage = options.usage
  const recentWindow = options.window ?? (() => "24h" as const)

  const recentRows = (): readonly WhatsappRecentRow[] =>
    (usage()?.recent ?? []).map((row) => ({
      code: row.code ?? messageTranslate("admin.whatsapp.noSender"),
      createdAt: row.createdAt,
      endpointId: row.endpointId,
      phone: row.recipientPhone ?? row.recipientHashPrefix,
      purpose: row.purpose,
      sessionName: row.sessionName,
      status: row.status,
    }))

  const windowOptions = (): readonly WhatsappWindowOption[] =>
    (
      [
        { label: messageTranslate("admin.whatsapp.dayWindow"), value: "24h" },
        { label: messageTranslate("admin.whatsapp.window3d"), value: "3d" },
        { label: messageTranslate("admin.whatsapp.window7d"), value: "7d" },
      ] as const
    ).map((option) => ({ ...option, selected: option.value === recentWindow() }))

  const senderCards = (): readonly WhatsappSenderCard[] =>
    (usage()?.senders ?? []).map((sender) => ({
      day: whatsappQuotaWindowCreate(
        sender.sessionName,
        sender.sentLastDay,
        usage()?.limits.dailyPerSender ?? 0,
        messageTranslate("admin.whatsapp.dayWindow"),
      ),
      dimmed: !sender.healthy,
      endpointId: sender.endpointId,
      healthLabel: messageTranslate(sender.healthy ? "admin.whatsapp.healthy" : "admin.whatsapp.unhealthy"),
      healthTone: sender.healthy ? "success" : "danger",
      hour: whatsappQuotaWindowCreate(
        sender.sessionName,
        sender.sentLastHour,
        usage()?.limits.hourlyPerSender ?? 0,
        messageTranslate("admin.whatsapp.hourWindow"),
      ),
      sessionName: sender.sessionName,
    }))

  const purposeEntries = (): readonly WhatsappPurposeEntry[] =>
    Object.entries(usage()?.attempts.byPurposeLastDay ?? {})
      .map(([name, count]) => ({ count, name }))
      .sort((left, right) => right.count - left.count)

  const tightestRemaining = (): number | undefined => {
    const remaining = (usage()?.senders ?? []).map((sender) => sender.remainingDay)
    return remaining.length === 0 ? undefined : Math.min(...remaining)
  }

  return {
    purposeEntries,
    recentRows,
    recentStatusGet: whatsappRecentStatusGet,
    windowOptions,
    remainingHint: (): string | undefined => {
      const remaining = tightestRemaining()
      return remaining === undefined
        ? undefined
        : messageTranslate("admin.whatsapp.remainingHint", { count: remaining })
    },
    senderCards,
    tiles: (): readonly { readonly label: string; readonly value: number }[] => [
      { label: messageTranslate("admin.whatsapp.requestsHour"), value: usage()?.requests.otpRequestedLastHour ?? 0 },
      { label: messageTranslate("admin.whatsapp.requestsDay"), value: usage()?.requests.otpRequestedLastDay ?? 0 },
      { label: messageTranslate("admin.whatsapp.sentHour"), value: usage()?.totals.sentLastHour ?? 0 },
      { label: messageTranslate("admin.whatsapp.sentDay"), value: usage()?.totals.sentLastDay ?? 0 },
      { label: messageTranslate("admin.whatsapp.blockedDay"), value: usage()?.attempts.byStatusLastDay.blocked ?? 0 },
      { label: messageTranslate("admin.whatsapp.failedDay"), value: usage()?.attempts.byStatusLastDay.failed ?? 0 },
    ],
    tightestRemaining,
  }
}
