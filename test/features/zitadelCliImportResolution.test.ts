import { expect, test } from "bun:test"
import * as config from "@adaptive-ds/zitadel-cli/config"
import * as transport from "@adaptive-ds/zitadel-cli/transport"
import * as v2 from "@adaptive-ds/zitadel-cli/v2"

test("ZITADEL CLI v2, config, and transport exports resolve with declarations", () => {
  expect(Object.keys(v2).length).toBeGreaterThan(0)
  expect(Object.keys(config).length).toBeGreaterThan(0)
  expect(Object.keys(transport).length).toBeGreaterThan(0)
})
