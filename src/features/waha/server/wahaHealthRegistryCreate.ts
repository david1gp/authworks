import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { WahaHealthPort } from "../domain/wahaHealthPort.js"
import type { WahaHealthPortResult } from "../domain/wahaHealthPortResult.js"
import { wahaHealthCandidateRepositoryCreate } from "../persistence/wahaHealthCandidateRepositoryCreate.js"
import type { WahaHealthCandidateRow } from "../persistence/wahaHealthCandidateTable.js"
import type { WahaConfiguration } from "./wahaConfiguration.js"
import type { WahaEndpointConfiguration } from "./wahaEndpointConfiguration.js"

type WahaHealthRegistryCreateOptions = {
  readonly configuration: WahaConfiguration
  readonly healthPort: WahaHealthPort
  readonly repository: ReturnType<typeof wahaHealthCandidateRepositoryCreate>
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now">
}

export function wahaHealthRegistryCreate(options: WahaHealthRegistryCreateOptions) {
  let refreshInFlight: Promise<Result<void>> | undefined

  const refresh = (): Promise<Result<void>> => {
    if (refreshInFlight !== undefined) return refreshInFlight
    const operation = refreshRun()
    refreshInFlight = operation
    void operation.then(
      () => {
        if (refreshInFlight === operation) refreshInFlight = undefined
      },
      () => {
        if (refreshInFlight === operation) refreshInFlight = undefined
      },
    )
    return operation
  }

  return {
    markUnhealthy(input: {
      readonly endpointId: string
      readonly expectedVersion: number
      readonly failureCode?: string
      readonly failureMessage?: string
      readonly sessionName: string
    }): Result<WahaHealthCandidateRow> {
      const now = (options.runtime ?? runtimeCreate()).now()
      return options.repository.wahaHealthCandidateMarkUnhealthy(input.endpointId, input.sessionName, {
        expectedVersion: input.expectedVersion,
        failureAt: now,
        failureCode: input.failureCode ?? "waha.delivery-failed",
        failureMessage: input.failureMessage ?? "The WhatsApp message could not be delivered.",
        updatedAt: now,
      })
    },
    refresh,
  }

  async function refreshRun(): Promise<Result<void>> {
    const now = (options.runtime ?? runtimeCreate()).now()
    const expired = options.repository.wahaHealthCandidateExpireStale(now)
    if (!expired.success) return expired

    const rows = options.repository.wahaHealthCandidateList()
    if (!rows.success) return rows
    const configuredEndpointIds = new Set(options.configuration.endpoints.map((endpoint) => endpoint.id))
    const removedEndpointRows = rows.data.filter((row) => !configuredEndpointIds.has(row.endpointId))
    const reconciled = endpointRowsMarkUnhealthy(
      removedEndpointRows,
      now,
      "The WAHA endpoint is no longer configured.",
      true,
    )
    if (!reconciled.success) return reconciled

    for (const endpoint of options.configuration.endpoints) {
      const refreshed = await refreshEndpoint(endpoint, now)
      if (!refreshed.success) return refreshed
    }
    return resultCreate(undefined)
  }

  async function refreshEndpoint(endpoint: WahaEndpointConfiguration, checkedAt: number): Promise<Result<void>> {
    const health = await healthCheck(endpoint.id)
    const rows = options.repository.wahaHealthCandidateList()
    if (!rows.success) return rows
    const endpointRows = rows.data.filter((row) => row.endpointId === endpoint.id)

    if (!health.success) {
      return endpointRowsMarkUnhealthy(endpointRows, checkedAt, "The WAHA health check failed.")
    }

    const sessions = new Map(
      health.data.sessions
        .filter(({ name }) => endpoint.senderSessions === undefined || endpoint.senderSessions.includes(name))
        .map((session) => [session.name, session]),
    )
    for (const row of endpointRows) {
      if (sessions.has(row.sessionName)) continue
      const updated = candidateMarkUnhealthy(row, checkedAt, "The WAHA session was not returned by WAHA.", true)
      if (!updated.success) return updated
    }

    for (const session of sessions.values()) {
      const existing = endpointRows.find((row) => row.sessionName === session.name)
      if (existing !== undefined && candidateDeliveryFailureIsNew(existing, checkedAt)) continue
      const input = {
        checkedAt,
        endpointId: endpoint.id,
        expiresAt: checkedAt + options.configuration.freshnessTtlMs,
        failureAt: health.data.status === "ok" && session.status === "WORKING" ? null : checkedAt,
        failureCode: health.data.status === "ok" && session.status === "WORKING" ? null : "waha.health-failed",
        failureMessage:
          health.data.status === "ok" && session.status === "WORKING"
            ? null
            : health.data.status !== "ok"
              ? "The WAHA server health check did not return ok."
              : "The WAHA session is not working.",
        sessionName: session.name,
        status: health.data.status === "ok" && session.status === "WORKING" ? "healthy" : "unhealthy",
        updatedAt: checkedAt,
      } as const
      const written =
        existing === undefined
          ? options.repository.wahaHealthCandidateCreateOrUpdate({
              ...input,
              createdAt: checkedAt,
              version: 1,
            })
          : options.repository.wahaHealthCandidateUpdate(endpoint.id, session.name, existing.version, input)
      if (!written.success && written.code === "waha.conflict") continue
      if (!written.success) return written
    }

    return resultCreate(undefined)
  }

  async function healthCheck(endpointId: string): Promise<Result<WahaHealthPortResult>> {
    try {
      return await options.healthPort.check({ endpointId })
    } catch (_error) {
      return resultErrorCodedCreate("wahaHealthRegistryRefresh", "The WAHA health check failed.", "waha.health-failed")
    }
  }

  function endpointRowsMarkUnhealthy(
    rows: readonly WahaHealthCandidateRow[],
    checkedAt: number,
    failureMessage: string,
    expire: boolean = false,
  ): Result<void> {
    for (const row of rows) {
      const updated = candidateMarkUnhealthy(row, checkedAt, failureMessage, expire)
      if (!updated.success) return updated
    }
    return resultCreate(undefined)
  }

  function candidateMarkUnhealthy(
    row: WahaHealthCandidateRow,
    checkedAt: number,
    failureMessage: string,
    expire: boolean,
  ): Result<void> {
    if (candidateDeliveryFailureIsNew(row, checkedAt)) {
      if (!expire || row.expiresAt <= checkedAt) return resultCreate(undefined)
      const expired = options.repository.wahaHealthCandidateUpdate(row.endpointId, row.sessionName, row.version, {
        expiresAt: checkedAt,
        updatedAt: Math.max(row.updatedAt, checkedAt),
      })
      if (!expired.success && expired.code === "waha.conflict") return resultCreate(undefined)
      if (!expired.success) return expired
      return resultCreate(undefined)
    }
    const updated = options.repository.wahaHealthCandidateUpdate(row.endpointId, row.sessionName, row.version, {
      checkedAt,
      expiresAt: expire ? checkedAt : checkedAt + options.configuration.freshnessTtlMs,
      failureAt: checkedAt,
      failureCode: "waha.health-failed",
      failureMessage,
      status: "unhealthy",
      updatedAt: checkedAt,
    })
    if (!updated.success && updated.code === "waha.conflict") return resultCreate(undefined)
    if (!updated.success) return updated
    return resultCreate(undefined)
  }

  function candidateDeliveryFailureIsNew(row: WahaHealthCandidateRow, checkedAt: number): boolean {
    return (
      row.status === "unhealthy" &&
      row.failureCode === "waha.delivery-failed" &&
      row.failureAt !== null &&
      row.failureAt >= checkedAt
    )
  }
}
