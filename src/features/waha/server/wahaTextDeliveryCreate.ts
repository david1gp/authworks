import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import { wahaChatIdCreate } from "../domain/wahaChatIdCreate.js"
import type { WahaDeliveryPort } from "../domain/wahaDeliveryPort.js"
import type { WahaTextDeliveryPort } from "../domain/wahaTextDeliveryPort.js"
import { wahaHealthCandidateRepositoryCreate } from "../persistence/wahaHealthCandidateRepositoryCreate.js"
import type { WahaHealthCandidateRow } from "../persistence/wahaHealthCandidateTable.js"
import { wahaHealthCandidateSelectorCreate } from "./wahaHealthCandidateSelectorCreate.js"
import { wahaHealthRegistryCreate } from "./wahaHealthRegistryCreate.js"

type WahaTextDeliveryCreateOptions = {
  readonly deliveryPort: WahaDeliveryPort
  readonly healthRegistry: Pick<ReturnType<typeof wahaHealthRegistryCreate>, "markUnhealthy">
  readonly repository: ReturnType<typeof wahaHealthCandidateRepositoryCreate>
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

export function wahaTextDeliveryCreate(options: WahaTextDeliveryCreateOptions) {
  const selector = wahaHealthCandidateSelectorCreate({ repository: options.repository, runtime: options.runtime })

  const delivery: WahaTextDeliveryPort = {
    sendText(input: { readonly phoneNumber: string; readonly text: string }): Promise<Result<void>> {
      return wahaTextDeliverySend(input)
    },
  }
  return delivery

  async function wahaTextDeliverySend(input: {
    readonly phoneNumber: string
    readonly text: string
  }): Promise<Result<void>> {
    const chatId = wahaChatIdCreate(input.phoneNumber)
    if (!chatId.success) return chatId

    const selected = selector.select()
    if (!selected.success) return selected
    if (selected.data === null)
      return resultErrorCodedCreate(
        "wahaTextDeliverySend",
        "No fresh healthy WAHA candidate is available.",
        "waha.no-healthy-candidate",
      )

    const firstAttempt = await candidateSend(selected.data, chatId.data, input.text)
    if (firstAttempt.success) return firstAttempt
    void candidateMarkUnhealthy(selected.data)

    const retry = selector.select([selected.data])
    if (!retry.success) return firstAttempt
    if (retry.data === null) return firstAttempt

    const secondAttempt = await candidateSend(retry.data, chatId.data, input.text)
    if (secondAttempt.success) return secondAttempt
    void candidateMarkUnhealthy(retry.data)
    return secondAttempt
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
