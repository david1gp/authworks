import { expect, test } from "bun:test"
import { wahaConfigurationParse } from "../../src/features/waha/server/wahaConfigurationParse.js"
import { wahaHealthPortCreate } from "../../src/features/waha/server/wahaHealthPortCreate.js"

const enabled = process.env.AUTHWORKS_WAHA_LIVE_TEST === "1" || process.env.AUTHWORKS_WAHA_LIVE_TEST === "true"

test.skipIf(!enabled)("live WAHA health is separately gated and requires a working configured session", async () => {
  const configuration = wahaConfigurationParse(process.env)
  expect(configuration.success).toBe(true)
  if (!configuration.success || configuration.data === undefined) return
  const endpoint = configuration.data.endpoints[0]
  expect(endpoint).toBeDefined()
  if (endpoint === undefined) return
  const checked = await wahaHealthPortCreate({ configuration: configuration.data }).check({ endpointId: endpoint.id })
  expect(checked).toMatchObject({ success: true, data: { status: "ok" } })
  if (checked.success) expect(checked.data.sessions.some((session) => session.status === "WORKING")).toBe(true)
})
