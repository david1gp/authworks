import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { wahaChatIdCreate } from "../domain/wahaChatIdCreate.js"
import type { WahaDeliveryPort } from "../domain/wahaDeliveryPort.js"
import type { WahaSendAttemptStatus } from "../domain/wahaSendAttemptStatusSchema.js"
import type { WahaTextDeliveryPort } from "../domain/wahaTextDeliveryPort.js"
import { wahaHealthCandidateRepositoryCreate } from "../persistence/wahaHealthCandidateRepositoryCreate.js"
import type { WahaHealthCandidateRow } from "../persistence/wahaHealthCandidateTable.js"
import { wahaSendAttemptRepositoryCreate } from "../persistence/wahaSendAttemptRepositoryCreate.js"
import type { WahaConfiguration } from "./wahaConfiguration.js"
import { wahaHealthCandidateSelectorCreate } from "./wahaHealthCandidateSelectorCreate.js"
import { wahaHealthRegistryCreate } from "./wahaHealthRegistryCreate.js"
import { wahaRecipientHashCreate } from "./wahaRecipientHashCreate.js"
import { wahaSenderQuotaCreate } from "./wahaSenderQuotaCreate.js"

type WahaTextDeliveryCreateOptions = {
  readonly configuration: WahaConfiguration
  readonly deliveryPort: WahaDeliveryPort
  readonly healthRegistry: Pick<ReturnType<typeof wahaHealthRegistryCreate>, "markUnhealthy">
  readonly recipientHashSecret?: Secret | string
  readonly repository: ReturnType<typeof wahaHealthCandidateRepositoryCreate>
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly sendAttempts: ReturnType<typeof wahaSendAttemptRepositoryCreate>
}

export function wahaTextDeliveryCreate(options: WahaTextDeliveryCreateOptions) {
  const runtime = options.runtime ?? runtimeCreate()
  const selector = wahaHealthCandidateSelectorCreate({
    configuration: options.configuration,
    quota: wahaSenderQuotaCreate({ configuration: options.configuration, sendAttempts: options.sendAttempts }),
    repository: options.repository,
    runtime: options.runtime,
  })

  const delivery: WahaTextDeliveryPort = {
    sendText(input: {
      readonly phoneNumber: string
      readonly purpose?: string
      readonly realmId?: string
      readonly text: string
    }): Promise<Result<void>> {
      return wahaTextDeliverySend(input)
    },
  }
  return delivery

  async function wahaTextDeliverySend(input: {
    readonly phoneNumber: string
    readonly purpose?: string
    readonly realmId?: string
    readonly text: string
  }): Promise<Result<void>> {
    const chatId = wahaChatIdCreate(input.phoneNumber)
    if (!chatId.success) return chatId
    const now = runtime.now()
    if (!Number.isSafeInteger(now) || now < 0)
      return resultErrorCodedCreate("wahaTextDeliverySend", "The WAHA send timestamp is invalid.", "waha.internal")

    const selected = selector.select()
    if (!selected.success) return selected
    if (selected.data === null) {
      wahaSendAttemptRecordCreate({
        createdAt: now,
        phoneNumber: input.phoneNumber,
        purpose: input.purpose ?? "unknown",
        realmId: input.realmId ?? null,
        sessionName: null,
        status: "blocked",
      })
      return resultErrorCodedCreate(
        "wahaTextDeliverySend",
        "No fresh healthy WAHA candidate is available.",
        "waha.no-healthy-candidate",
      )
    }

    const firstAttempt = await candidateSend(selected.data, chatId.data, input.text)
    wahaSendAttemptRecordCreate({
      createdAt: now,
      endpointId: selected.data.endpointId,
      phoneNumber: input.phoneNumber,
      purpose: input.purpose ?? "unknown",
      realmId: input.realmId ?? null,
      sessionName: selected.data.sessionName,
      status: firstAttempt.success ? "sent" : "failed",
    })
    if (firstAttempt.success) return firstAttempt
    void candidateMarkUnhealthy(selected.data)

    const retry = selector.select([selected.data])
    if (!retry.success) return firstAttempt
    if (retry.data === null) return firstAttempt

    const secondAttempt = await candidateSend(retry.data, chatId.data, input.text)
    wahaSendAttemptRecordCreate({
      createdAt: now,
      endpointId: retry.data.endpointId,
      phoneNumber: input.phoneNumber,
      purpose: input.purpose ?? "unknown",
      realmId: input.realmId ?? null,
      sessionName: retry.data.sessionName,
      status: secondAttempt.success ? "sent" : "failed",
    })
    if (secondAttempt.success) return secondAttempt
    void candidateMarkUnhealthy(retry.data)
    return secondAttempt
  }

  function wahaSendAttemptRecordCreate(input: {
    readonly createdAt: number
    readonly endpointId?: string
    readonly phoneNumber: string
    readonly purpose: string
    readonly realmId: string | null
    readonly sessionName: string | null
    readonly status: WahaSendAttemptStatus
  }): void {
    const endpointId = input.endpointId ?? options.configuration.endpoints[0]?.id
    if (endpointId === undefined) return
    options.sendAttempts.wahaSendAttemptRecord({
      createdAt: input.createdAt,
      endpointId,
      id: uuidv7Create(runtime),
      purpose: input.purpose,
      realmId: input.realmId,
      recipientPhoneHash: wahaRecipientHashCreate(options.recipientHashSecret, input.phoneNumber),
      sessionName: input.sessionName,
      status: input.status,
    })
  }

  async function candidateSend(candidate: WahaHealthCandidateRow, chatId: string, text: string): Promise<Result<void>> {
    return options.deliveryPort.sendText({
      chatId,
      endpointId: candidate.endpointId,
      sessionName: candidate.sessionName,
      text,
    })
  }

  function candidateMarkUnhealthy(candidate: WahaHealthCandidateRow): Result<WahaHealthCandidateRow> {
    const marked = options.healthRegistry.markUnhealthy({
      endpointId: candidate.endpointId,
      expectedVersion: candidate.version,
      sessionName: candidate.sessionName,
    })
    if (marked.success) return marked
    if (marked.code !== "waha.conflict") return marked

    const current = options.repository.wahaHealthCandidateGet(candidate.endpointId, candidate.sessionName)
    if (!current.success) return current
    if (current.data === null)
      return resultErrorCodedCreate(
        "wahaTextDeliveryCandidateMarkUnhealthy",
        "The WAHA health candidate was not found.",
        "waha.not-found",
      )
    if (current.data.status === "unhealthy") return resultCreate(current.data)

    const retried = options.healthRegistry.markUnhealthy({
      endpointId: current.data.endpointId,
      expectedVersion: current.data.version,
      sessionName: current.data.sessionName,
    })
    if (retried.success) return retried
    if (retried.code !== "waha.conflict") return retried

    const latest = options.repository.wahaHealthCandidateGet(candidate.endpointId, candidate.sessionName)
    if (!latest.success) return latest
    if (latest.data === null)
      return resultErrorCodedCreate(
        "wahaTextDeliveryCandidateMarkUnhealthy",
        "The WAHA health candidate was not found.",
        "waha.not-found",
      )
    return resultCreate(latest.data)
  }
}
