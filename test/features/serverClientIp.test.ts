import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { realmCreate } from "../../src/features/realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../src/features/realms/domain/realmSystemContextCreate.js"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { storageDatabaseOpen } from "../../src/platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../src/platform/testkit/platformTestkitCreate.js"

const rateLimitSecret = "server-client-ip-rate-limit-secret"
const trustedProxy = "203.0.113.10"

test("composed WhatsApp routes isolate direct peers and honor trusted forwarding", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-server-client-ip-"))
  const databasePath = join(directory, "authworks.sqlite")
  const testkit = platformTestkitCreate()
  const prepared = storageDatabaseOpen(databasePath, testkit.runtime)
  expect(prepared.success).toBe(true)
  if (!prepared.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }
  const realm = realmCreate({
    context: realmSystemContextCreate("system"),
    database: prepared.data,
    input: { domain: "server-client-ip.example.com", name: "Server client IP" },
  })
  expect(realm.success).toBe(true)
  if (!realm.success) {
    prepared.data.close()
    await rm(directory, { force: true, recursive: true })
    return
  }
  prepared.data.close()

  const directPeerByRequest = new WeakMap<Request, string>()
  const created = serverApplicationCreate({
    clientIpResolve: (request) => directPeerByRequest.get(request),
    databasePath,
    runtime: testkit.runtime,
    systemSecret: rateLimitSecret,
    trustedProxyAddresses: [trustedProxy],
    whatsappAvailability: {
      whatsappOtpAvailabilityGet: () => ({ data: { available: true }, success: true as const }),
    },
    whatsappDelivery: {
      sendText: async () => ({ data: undefined, success: true as const }),
    },
  })
  expect(created.success).toBe(true)
  if (!created.success) {
    await rm(directory, { force: true, recursive: true })
    return
  }

  const postRegistration = async (peer: string, prefix: string, index: number, forwardedFor?: string) => {
    const request = new Request(
      `https://server-client-ip.example.com/realms/${realm.data.realm.id}/password/register`,
      {
        body: JSON.stringify({
          email: `${prefix}-${index}@example.com`,
          password: "Correct Horse 12",
          phoneNumber: `+141555${String(10000 + index + (prefix === "direct-b" ? 100 : prefix === "trusted-b" ? 200 : 0)).padStart(5, "0")}`,
          profile: {},
          userName: `${prefix}-${index}`,
          verificationMethod: "whatsapp",
        }),
        headers: {
          "content-type": "application/json",
          ...(forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor }),
        },
        method: "POST",
      },
    )
    directPeerByRequest.set(request, peer)
    return await created.data.fetch(request)
  }
  const postOtpStart = async (peer: string, prefix: string, index: number, forwardedFor?: string) => {
    const request = new Request(
      `https://server-client-ip.example.com/realms/${realm.data.realm.id}/whatsapp-otp/start`,
      {
        body: JSON.stringify({
          phoneNumber: `+141566${String(10000 + index + (prefix === "otp-direct-b" ? 100 : prefix === "otp-trusted-b" ? 200 : 0)).padStart(5, "0")}`,
        }),
        headers: {
          "content-type": "application/json",
          ...(forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor }),
        },
        method: "POST",
      },
    )
    directPeerByRequest.set(request, peer)
    return await created.data.fetch(request)
  }

  try {
    const directA = await postSeries(postRegistration, "198.51.100.10", "direct-a")
    expect(directA.filter((response) => response.status === 200)).toHaveLength(5)
    expect(directA.filter((response) => response.status === 429)).toHaveLength(1)

    const directB = await postSeries(postRegistration, "198.51.100.11", "direct-b")
    expect(directB.filter((response) => response.status === 200)).toHaveLength(5)
    expect(directB.filter((response) => response.status === 429)).toHaveLength(1)

    testkit.advance(60_000)
    const forgedForwarding = await postSeries(
      (peer, prefix, index) => postRegistration(peer, prefix, index, `198.51.100.${30 + index}`),
      "198.51.100.12",
      "untrusted-forwarded",
    )
    expect(forgedForwarding.filter((response) => response.status === 200)).toHaveLength(5)
    expect(forgedForwarding.filter((response) => response.status === 429)).toHaveLength(1)

    testkit.advance(60_000)
    const trustedA = await postSeries(
      (peer, prefix, index) => postRegistration(peer, prefix, index, "198.51.100.40"),
      trustedProxy,
      "trusted-a",
    )
    expect(trustedA.filter((response) => response.status === 200)).toHaveLength(5)
    expect(trustedA.filter((response) => response.status === 429)).toHaveLength(1)

    const trustedB = await postSeries(
      (peer, prefix, index) => postRegistration(peer, prefix, index, "198.51.100.41"),
      trustedProxy,
      "trusted-b",
    )
    expect(trustedB.filter((response) => response.status === 200)).toHaveLength(5)
    expect(trustedB.filter((response) => response.status === 429)).toHaveLength(1)

    testkit.advance(60_000)
    const otpDirectA = await postSeries(postOtpStart, "198.51.100.20", "otp-direct-a")
    expect(otpDirectA.filter((response) => response.status === 200)).toHaveLength(5)
    expect(otpDirectA.filter((response) => response.status === 429)).toHaveLength(1)

    const otpDirectB = await postSeries(postOtpStart, "198.51.100.21", "otp-direct-b")
    expect(otpDirectB.filter((response) => response.status === 200)).toHaveLength(5)
    expect(otpDirectB.filter((response) => response.status === 429)).toHaveLength(1)

    testkit.advance(60_000)
    const otpTrustedA = await postSeries(
      (peer, prefix, index) => postOtpStart(peer, prefix, index, "198.51.100.50"),
      trustedProxy,
      "otp-trusted-a",
    )
    expect(otpTrustedA.filter((response) => response.status === 200)).toHaveLength(5)
    expect(otpTrustedA.filter((response) => response.status === 429)).toHaveLength(1)

    const otpTrustedB = await postSeries(
      (peer, prefix, index) => postOtpStart(peer, prefix, index, "198.51.100.51"),
      trustedProxy,
      "otp-trusted-b",
    )
    expect(otpTrustedB.filter((response) => response.status === 200)).toHaveLength(5)
    expect(otpTrustedB.filter((response) => response.status === 429)).toHaveLength(1)
  } finally {
    created.data.stop()
    await rm(directory, { force: true, recursive: true })
  }
})

async function postSeries(
  post: (peer: string, prefix: string, index: number) => Promise<Response>,
  peer: string,
  prefix: string,
): Promise<Response[]> {
  const responses: Response[] = []
  for (let index = 0; index < 6; index += 1) responses.push(await post(peer, prefix, index))
  return responses
}
