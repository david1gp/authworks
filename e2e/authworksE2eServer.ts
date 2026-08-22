import { authworksE2eFixtureCreate } from "./authworksE2eFixtureCreate.js"
import { authworksE2eServerCreate } from "./authworksE2eServerCreate.js"

const credentialScenario = process.env.AUTHWORKS_E2E_CREDENTIAL_SCENARIO === "1"
const fixtureResult = await authworksE2eFixtureCreate({
  ...(credentialScenario
    ? {
        advancedAuthenticationUsers: ["administrator", "member"],
        emailDelivery: true,
      }
    : {}),
})
if (!fixtureResult.success) {
  console.error(`ERROR ${fixtureResult.errorMessage}`)
  process.exit(1)
}

const fixture = fixtureResult.data
const otherRealm = await fixture.clients.realms.realmCreate({
  domain: "other.e2e.authworks.test",
  name: "Other E2E Realm",
})
if (!otherRealm.success) {
  await fixture.close()
  console.error(`ERROR ${otherRealm.errorMessage}`)
  process.exit(1)
}

const server = authworksE2eServerCreate({ app: fixture.app, origin: fixture.origin })
const initialMailMessageCount = fixture.mailMessages?.length ?? 0
let invitationReporter: ReturnType<typeof setInterval> | undefined
let mailReporter: ReturnType<typeof setInterval> | undefined
if (credentialScenario) {
  const reported = new Set<number>()
  mailReporter = setInterval(() => {
    const messages = fixture.mailMessages ?? []
    for (let index = initialMailMessageCount; index < messages.length; index += 1) {
      if (reported.has(index)) continue
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
      reported.add(index)
    }
  }, 10)
  invitationReporter = setInterval(() => {
    const message = fixture.mailMessages
      ?.slice(initialMailMessageCount)
      .find((item) => item.message.text.startsWith(`${fixture.origin}/invitations/accept?token=`))
    if (message !== undefined) {
      if (invitationReporter !== undefined) clearInterval(invitationReporter)
      console.log(JSON.stringify({ invitationLink: message.message.text }))
    }
  }, 10)
}

console.log(JSON.stringify({ ready: true, ...fixtureMetadataCreate(server.url.origin, otherRealm.data.realm.id) }))

process.on("SIGTERM", () => void serverShutdown())
process.on("SIGINT", () => void serverShutdown())

async function serverShutdown() {
  if (invitationReporter !== undefined) clearInterval(invitationReporter)
  if (mailReporter !== undefined) clearInterval(mailReporter)
  server.stop()
  await fixture.close()
  process.exit(0)
}

function fixtureMetadataCreate(serverOrigin: string, otherRealmId: string) {
  return {
    bootstrapAdmin: fixture.bootstrapAdmin,
    discoveryDomain: fixture.discoveryDomain,
    externalProvider: fixture.externalProvider,
    machineUser: { clientSecret: fixture.machineUser.clientSecret, id: fixture.machineUser.id },
    administrator: fixture.administrator,
    administratorRecoveryCode: fixture.administratorRecoveryCode,
    member: fixture.member,
    organization: fixture.organization,
    secondaryOrganization: fixture.secondaryOrganization,
    oidcClients: fixture.oidcClients,
    origin: fixture.origin,
    otherRealmId,
    realm: { id: fixture.realm.id },
    recoveryCode: fixture.recoveryCode,
    serverOrigin,
  }
}
