import { randomBytes } from "node:crypto"
import { authworksE2eFixtureCreate } from "./authworksE2eFixtureCreate.js"
import { authworksE2eServerCreate } from "./authworksE2eServerCreate.js"

const clock = { now: Date.now() }
const browserCeremony = process.env.AUTHWORKS_E2E_BROWSER_CEREMONY === "1"
const fixtureResult = await authworksE2eFixtureCreate({
  advancedAuthentication: true,
  emailDelivery: true,
  ...(browserCeremony ? { passkeyOrigins: ["http://localhost:5174"], passkeyRpId: "localhost" } : {}),
  ...(browserCeremony ? {} : { runtime: { now: () => clock.now, randomBytes: (length) => randomBytes(length) } }),
})
if (!fixtureResult.success) {
  console.error(`ERROR ${fixtureResult.errorMessage}`)
  process.exit(1)
}

const fixture = fixtureResult.data
const server = authworksE2eServerCreate({ app: fixture.app, origin: fixture.origin })
const initialMailMessageCount = fixture.mailMessages?.length ?? 0
const reportedMailMessages = new Set<number>()
const mailReporter = setInterval(() => {
  const messages = fixture.mailMessages ?? []
  for (let index = initialMailMessageCount; index < messages.length; index += 1) {
    if (reportedMailMessages.has(index)) continue
    const message = messages[index]
    if (message === undefined) continue
    const link = message.message.text.trim()
    let pathname: string
    try {
      pathname = new URL(link).pathname
    } catch (_error) {
      continue
    }
    if (pathname === "/login/verify-email") console.log(JSON.stringify({ verificationLink: link }))
    if (pathname === "/login/password/reset") console.log(JSON.stringify({ recoveryLink: link }))
    reportedMailMessages.add(index)
  }
}, 10)

console.log(
  JSON.stringify({
    discoveryDomain: fixture.discoveryDomain,
    member: fixture.member,
    organization: fixture.organization,
    origin: fixture.origin,
    recoveryCode: fixture.recoveryCode,
    realm: { id: fixture.realm.id },
    secondaryOrganization: fixture.secondaryOrganization,
    serverOrigin: server.url.origin,
    ready: true,
  }),
)

process.on("SIGUSR1", () => {
  clock.now += 31 * 24 * 60 * 60 * 1_000
})
process.on("SIGTERM", () => void serverShutdown())
process.on("SIGINT", () => void serverShutdown())

async function serverShutdown() {
  clearInterval(mailReporter)
  server.stop()
  await fixture.close()
  process.exit(0)
}
