import { serverHealth, sessionList } from "@adaptive-ds/waha-client"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { WahaHealthPort } from "../domain/wahaHealthPort.js"
import type { WahaHealthPortResult } from "../domain/wahaHealthPortResult.js"
import type { WahaConfiguration } from "./wahaConfiguration.js"

type WahaHealthPortCreateOptions = {
  readonly configuration: WahaConfiguration
}

export function wahaHealthPortCreate(options: WahaHealthPortCreateOptions): WahaHealthPort {
  return {
    async check(input): Promise<Result<WahaHealthPortResult>> {
      const endpoint = options.configuration.endpoints.find((candidate) => candidate.id === input.endpointId)
      if (endpoint === undefined)
        return resultErrorCodedCreate(
          "wahaHealthPortCheck",
          "The configured WAHA endpoint was not found.",
          "waha.not-found",
        )

      const health = await serverHealth({ config: endpoint.client })
      if (!health.success)
        return resultErrorCodedCreate("wahaHealthPortCheck", "The WAHA health check failed.", "waha.health-failed")
      if (health.data.status !== "ok") return resultCreate({ sessions: [], status: "error" })

      const sessions = await sessionList({ all: true, config: endpoint.client })
      if (!sessions.success)
        return resultErrorCodedCreate("wahaHealthPortCheck", "The WAHA session list failed.", "waha.health-failed")

      return resultCreate({
        sessions: sessions.data.map(({ name, status }) => ({ name, status })),
        status: "ok",
      })
    },
  }
}
