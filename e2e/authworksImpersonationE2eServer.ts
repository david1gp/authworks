import { randomBytes } from "node:crypto"
import { authworksE2eFixtureCreate } from "./authworksE2eFixtureCreate.js"
import { authworksE2eServerCreate } from "./authworksE2eServerCreate.js"

const clock = { now: Date.now() }
const fixtureResult = await authworksE2eFixtureCreate({
  advancedAuthentication: true,
  runtime: { now: () => clock.now, randomBytes: (length) => randomBytes(length) },
})
if (!fixtureResult.success) {
  console.error(`ERROR ${fixtureResult.errorMessage}`)
  process.exit(1)
}

const fixture = fixtureResult.data
const policy = await fixture.clients.mfa.mfaPolicySet(fixture.realm.id, {
  lockoutDurationMs: 15 * 60 * 1_000,
  maxAttempts: 5,
  mode: "disabled",
  totpWindow: 1,
})
if (!policy.success) {
  await fixture.close()
  console.error(`ERROR ${policy.errorMessage}`)
  process.exit(1)
}
clock.now += 1_000

const server = authworksE2eServerCreate({ app: fixture.app, origin: fixture.origin })
if (fixture.recoveryCode === undefined) {
  server.stop()
  await fixture.close()
  console.error("ERROR The E2E recovery code was not created.")
  process.exit(1)
}

console.log(
  JSON.stringify({
    administrator: fixture.administrator,
    bootstrapAdmin: fixture.bootstrapAdmin,
    discoveryDomain: fixture.discoveryDomain,
    member: fixture.member,
    origin: fixture.origin,
    recoveryCode: fixture.recoveryCode,
    realm: { id: fixture.realm.id },
    serverOrigin: server.url.origin,
    now: clock.now,
    ready: true,
  }),
)

process.on("SIGUSR1", () => {
  clock.now += 6 * 60 * 1_000
})
process.on("SIGTERM", () => void serverShutdown())
process.on("SIGINT", () => void serverShutdown())

async function serverShutdown() {
  server.stop()
  await fixture.close()
  process.exit(0)
}
