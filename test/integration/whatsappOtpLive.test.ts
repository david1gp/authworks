import { expect, test } from "bun:test"
import {
  organizationApiClientCreate,
  organizationDiscoveryResponseSchema,
  type OrganizationDiscoveryResponse,
} from "@adaptive-ds/authworks/organizations"
import { passwordApiClientCreate } from "@adaptive-ds/authworks/passwords"
import { realmApiClientCreate, type Realm } from "@adaptive-ds/authworks/realms"
import { userApiClientCreate } from "@adaptive-ds/authworks/users"
import { whatsappOtpApiClientCreate } from "@adaptive-ds/authworks/whatsappOtp"
import {
  type MeInfo,
  type WAMessage,
  type WahaClientConfig,
  type WahaClientConfigInput,
  type WahaWebSocketEvent,
  type WahaWebSocketObserver,
  sessionMe,
  wahaClientConfig,
  wahaClientConfigSchema,
  wahaWebSocketObserve,
} from "@adaptive-ds/waha-client"
import * as v from "valibot"

// The package script runs this destructive test only when both gates are explicit:
// AUTHWORKS_WA_LIVE=1 AUTHWORKS_WA_CONFIRM=1. Set AUTHWORKS_WA_LOCAL=1 only for
// local HTTP endpoints. WAHA_RECIPIENT is one separate JSON object with { baseUrl,
// session, apiKey?, timeoutMs?, retries? }. Its session identity is read at runtime
// through sessionMe. The Authworks realm and organization are resolved from AUTHWORKS_URL
// through the published organizations and realms clients.
const liveTestEnabled =
  liveTestOptInIsEnabled(process.env.AUTHWORKS_WA_LIVE) && liveTestOptInIsEnabled(process.env.AUTHWORKS_WA_CONFIRM)

const requiredEnvironmentNames = ["AUTHWORKS_URL", "AUTHWORKS_SYSTEM_SECRET", "WAHA_RECIPIENT"] as const

const wahaMessagePayloadSchema: v.GenericSchema<unknown, WAMessage> = v.looseObject({
  body: v.optional(v.string()),
  from: v.string(),
  fromMe: v.boolean(),
  id: v.string(),
  timestamp: v.number(),
  to: v.string(),
})

const wahaRecipientInputSchema = v.object({
  ...wahaClientConfigSchema.entries,
  session: v.pipe(v.string(), v.minLength(1)),
})

type LiveTestResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly errorMessage: string; readonly success: false }
type LiveTestAccount = {
  readonly email: string
  readonly password: string
  readonly userName: string
}
type LiveWahaRecipientConfiguration = {
  readonly config: WahaClientConfig
  readonly session: string
}
type LiveTestConfiguration = {
  readonly authworksBaseUrl: string
  readonly systemToken: string
  readonly recipient: LiveWahaRecipientConfiguration
}
type LiveTestTenant = {
  readonly organizationId?: string
  readonly realmId: string
}
type LiveTestRealmCandidate = Pick<Realm, "domains" | "id" | "status">
type LiveTestOrganizationCandidate = Extract<OrganizationDiscoveryResponse, { found: true }>["organization"]
type LiveTestOrganizationApi = Pick<ReturnType<typeof organizationApiClientCreate>, "organizationTenantDomainDiscover">
type LiveTestRealmApi = Pick<ReturnType<typeof realmApiClientCreate>, "realmList">
type LiveWhatsappRecipient = {
  readonly recipientChatId: string
  readonly recipientPhoneNumber: string
}
type LiveWhatsappMessageObservation = {
  readonly notBeforeTimestamp: number
  readonly observer: WahaWebSocketObserver<WAMessage>
}
type LiveWhatsappMessageMatchOptions = {
  readonly notBeforeTimestamp: number
  readonly purpose: WhatsappOtpMessagePurpose
  readonly recipientChatId: string
  readonly recipientSession: string
}
type WhatsappOtpMessagePurpose = "registration" | "sign-in"

test.skipIf(!liveTestEnabled)(
  "creates, verifies, and signs in a temporary WhatsApp account through published APIs",
  async () => {
    const configurationResult = liveTestConfigurationParse(process.env)
    const parsedConfiguration = liveTestResultRequire(configurationResult, "configuration")

    const clientOptions = {
      baseUrl: parsedConfiguration.authworksBaseUrl,
      token: parsedConfiguration.systemToken,
    }
    const realms = realmApiClientCreate(clientOptions)
    const organizations = organizationApiClientCreate({ baseUrl: parsedConfiguration.authworksBaseUrl })
    const tenantResult = await liveTestTenantResolve({
      authworksBaseUrl: parsedConfiguration.authworksBaseUrl,
      organizations,
      realms,
    })
    const tenant = liveTestResultRequire(tenantResult, "tenant-resolution")
    const configuration = { ...parsedConfiguration, ...tenant }

    const passwords = passwordApiClientCreate({ baseUrl: configuration.authworksBaseUrl })
    const users = userApiClientCreate({
      baseUrl: configuration.authworksBaseUrl,
      systemToken: configuration.systemToken,
    })
    const whatsappOtp = whatsappOtpApiClientCreate({ baseUrl: configuration.authworksBaseUrl })
    const account = liveTestAccountCreate()

    let registrationObservation: LiveWhatsappMessageObservation | undefined
    let signInObservation: LiveWhatsappMessageObservation | undefined
    let registrationAccepted = false
    let testUserId: string | undefined
    let primaryFailure: Error | undefined
    let primaryFailureCaptured = false
    const cleanupErrors: string[] = []

    try {
      try {
        const availability = await whatsappOtp.whatsappOtpAvailabilityGet(
          configuration.realmId,
          configuration.organizationId,
        )
        const availabilityData = liveTestApiResultRequire(availability, "whatsapp-availability")
        if (!availabilityData.available)
          throw liveTestPhaseErrorCreate("whatsapp-availability", "WhatsApp OTP is unavailable.")

        const recipientResult = await liveWhatsappRecipientResolve(configuration.recipient)
        const recipient = liveTestResultRequire(recipientResult, "recipient-resolution")

        registrationObservation = liveWhatsappMessageObservationCreate({
          recipient: configuration.recipient,
          purpose: "registration",
          recipientChatId: recipient.recipientChatId,
        })
        const registrationReady = await liveWhatsappMessageObservationReady(registrationObservation)
        liveTestResultRequire(registrationReady, "registration-observers")

        const registered = await passwords.passwordRegister(configuration.realmId, {
          email: account.email,
          password: account.password,
          phoneNumber: recipient.recipientPhoneNumber,
          profile: { displayName: "Authworks WhatsApp live test" },
          userName: account.userName,
          verificationMethod: "whatsapp",
          ...(configuration.organizationId === undefined ? {} : { organizationId: configuration.organizationId }),
        })
        const registeredData = liveTestApiResultRequire(registered, "registration-request")
        registrationAccepted = true
        expect(registeredData.verificationRequired).toBe(true)
        expect(registeredData.verificationMethod === "whatsapp").toBe(true)
        expect(registeredData.challengeId !== undefined).toBe(true)
        if (registeredData.challengeId === undefined)
          throw liveTestPhaseErrorCreate("registration-response", "WhatsApp registration returned no challenge.")

        const registrationEvent = await liveWhatsappMessageObservationEventAwait(registrationObservation)
        const registrationEventData = liveTestResultRequire(registrationEvent, "registration-observation")
        const registrationCode = whatsappOtpMessageCodeParse(registrationEventData.payload.body, "registration")
        expect(registrationCode !== undefined).toBe(true)
        if (registrationCode === undefined)
          throw liveTestPhaseErrorCreate("registration-observation", "Registration OTP had no matching code.")

        const verifiedRegistration = await passwords.passwordWhatsappVerify(configuration.realmId, {
          challengeId: registeredData.challengeId,
          code: registrationCode,
        })
        const verifiedRegistrationData = liveTestApiResultRequire(verifiedRegistration, "registration-verification")
        testUserId = verifiedRegistrationData.user.id
        expect(verifiedRegistrationData.user.phoneNumber === recipient.recipientPhoneNumber).toBe(true)
        expect(verifiedRegistrationData.user.phoneNumberVerifiedAt !== undefined).toBe(true)

        signInObservation = liveWhatsappMessageObservationCreate({
          recipient: configuration.recipient,
          purpose: "sign-in",
          recipientChatId: recipient.recipientChatId,
        })
        const signInReady = await liveWhatsappMessageObservationReady(signInObservation)
        liveTestResultRequire(signInReady, "sign-in-observers")

        const started = await whatsappOtp.whatsappOtpStart(configuration.realmId, {
          phoneNumber: recipient.recipientPhoneNumber,
          ...(configuration.organizationId === undefined ? {} : { organizationId: configuration.organizationId }),
        })
        const startedData = liveTestApiResultRequire(started, "sign-in-request")
        expect(startedData.challengeId.length > 0).toBe(true)

        const signInEvent = await liveWhatsappMessageObservationEventAwait(signInObservation)
        const signInEventData = liveTestResultRequire(signInEvent, "sign-in-observation")
        const signInCode = whatsappOtpMessageCodeParse(signInEventData.payload.body, "sign-in")
        expect(signInCode !== undefined).toBe(true)
        if (signInCode === undefined)
          throw liveTestPhaseErrorCreate("sign-in-observation", "Sign-in OTP had no matching code.")

        const verified = await whatsappOtp.whatsappOtpVerify(configuration.realmId, {
          challengeId: startedData.challengeId,
          code: signInCode,
          ...(configuration.organizationId === undefined ? {} : { organizationId: configuration.organizationId }),
        })
        const verifiedData = liveTestApiResultRequire(verified, "sign-in-verification")

        const hasAuthenticatedSession = verifiedData.session !== undefined
        const hasMfaContinuation = verifiedData.challenge !== undefined
        expect(hasAuthenticatedSession || hasMfaContinuation).toBe(true)
        expect(verifiedData.authentication.realmId === configuration.realmId).toBe(true)
        expect(verifiedData.authentication.userId === testUserId).toBe(true)
        const session = verifiedData.session
        const challenge = verifiedData.challenge
        if (session !== undefined) expect(session.token.length > 0).toBe(true)
        if (challenge !== undefined) expect(challenge.token.length > 0).toBe(true)
      } catch (error) {
        primaryFailureCaptured = true
        primaryFailure = liveTestFailureRedact(error)
      }
    } finally {
      try {
        cleanupErrors.push(
          ...(await liveTestCleanup({
            account,
            realmId: configuration.realmId,
            registrationAccepted,
            registrationObservation,
            signInObservation,
            systemUsers: users,
            testUserId,
          })),
        )
      } catch {
        cleanupErrors.push("Cleanup failed unexpectedly.")
      }
    }

    if (primaryFailureCaptured) {
      const failure = primaryFailure ?? liveTestPhaseErrorCreate("execution")
      if (cleanupErrors.length > 0)
        throw new AggregateError(
          [failure, ...cleanupErrors.map((errorMessage) => new Error(errorMessage))],
          "WhatsApp live test failed and cleanup also reported errors.",
        )
      throw failure
    }
    if (cleanupErrors.length > 0) throw new Error(`WhatsApp live-test cleanup failed: ${cleanupErrors.join(" ")}`)
  },
)

test("normalizes a typed GOWS identity without using its lid", () => {
  const identity = {
    id: "15551234567@c.us",
    jid: "15551234567:1@s.whatsapp.net",
    lid: "99999999999@lid",
    pushName: "Mia",
  } satisfies MeInfo

  expect(liveWahaIdentityPhoneNumberNormalize(identity)).toBe("+15551234567")
  expect(liveWahaIdentityPhoneNumberNormalize({ id: "1@c.us", pushName: "Mia" })).toBe("+1")
  expect(liveWahaIdentityPhoneNumberNormalize({ id: "123456789012345@c.us", pushName: "Mia" })).toBe("+123456789012345")
  expect(liveWahaIdentityPhoneNumberNormalize({ id: "+15551234567", pushName: "Mia" })).toBe("+15551234567")
})

test("rejects unsafe typed GOWS phone identities", () => {
  const rejectedIdentities = [
    { id: "15551234567@c.us", jid: "15550000000:1@s.whatsapp.net", pushName: "Mia" },
    { id: "15551234567@c.us", jid: "15551234567@s.whatsapp.net", pushName: "Mia" },
    { id: "15551234567@c.us", jid: "15551234567:x@s.whatsapp.net", pushName: "Mia" },
    { id: "15551234567@c.us", jid: "15551234567:@s.whatsapp.net", pushName: "Mia" },
    { id: "15551234567@c.us", jid: "15551234567:1:2@s.whatsapp.net", pushName: "Mia" },
    { id: "15551234567@c.us", jid: "15551234567:1@c.us", pushName: "Mia" },
    { id: "15551234567@c.us", jid: "15551234567:1@lid", pushName: "Mia" },
    { id: "15551234567@c.us", jid: ":1@s.whatsapp.net", pushName: "Mia" },
    { id: "15551234567@c.us", jid: "1555123456x:1@s.whatsapp.net", pushName: "Mia" },
    { id: "15551234567@c.us", jid: "+15551234567:1@s.whatsapp.net", pushName: "Mia" },
    { id: "1234567890123456@c.us", pushName: "Mia" },
    { id: "15551234567@c.us", jid: "1234567890123456:1@s.whatsapp.net", pushName: "Mia" },
    { id: "0@c.us", pushName: "Mia" },
    { id: "15551234567@lid", pushName: "Mia" },
    { id: "", pushName: "Mia" },
    { id: "not-an-identity", pushName: "Mia" },
  ] satisfies readonly MeInfo[]

  for (const identity of rejectedIdentities) expect(liveWahaIdentityPhoneNumberNormalize(identity)).toBeUndefined()
})

test("parses the authorized WAHA recipient without production sender candidates", () => {
  const parsed = liveTestConfigurationParse({
    AUTHWORKS_SYSTEM_SECRET: "system-secret",
    AUTHWORKS_URL: "https://login.example.com",
    WAHA_RECIPIENT: JSON.stringify({
      apiKey: "recipient-secret",
      baseUrl: "https://recipient.example.com/",
      retries: 3,
      session: "authorized-recipient",
      timeoutMs: 7_000,
    }),
  })

  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data.recipient).toMatchObject({ session: "authorized-recipient" })
  expect(parsed.data.recipient.config).toMatchObject({
    baseUrl: "https://recipient.example.com",
    retries: 3,
    session: "authorized-recipient",
    timeoutMs: 7_000,
  })
  expect(parsed.data.recipient.config.apiKey).toBeDefined()
})

test("requires a valid independent WAHA recipient and applies the HTTPS policy", () => {
  expect(
    liveTestConfigurationParse({
      AUTHWORKS_SYSTEM_SECRET: "system-secret",
      AUTHWORKS_URL: "https://login.example.com",
      WAHA_RECIPIENT: JSON.stringify({ baseUrl: "http://recipient.example.com", session: "recipient-session" }),
    }),
  ).toEqual({ errorMessage: "WAHA_RECIPIENT must contain only HTTPS endpoints.", success: false })
  expect(
    liveTestConfigurationParse({
      AUTHWORKS_SYSTEM_SECRET: "system-secret",
      AUTHWORKS_URL: "https://login.example.com",
      WAHA_RECIPIENT: JSON.stringify({ baseUrl: "https://recipient.example.com" }),
    }),
  ).toMatchObject({ errorMessage: "WAHA_RECIPIENT must be a JSON object with a session.", success: false })
})

test("matches a fresh inbound recipient OTP event with the exact purpose template", () => {
  const notBeforeTimestamp = 2_000
  const options = liveWhatsappMessageMatchOptionsCreate(notBeforeTimestamp, "registration")

  expect(liveWhatsappMessageEventMatches(liveWhatsappMessageEventCreate(), options)).toBe(true)
  expect(
    liveWhatsappMessageEventMatches(
      liveWhatsappMessageEventCreate({ body: "Your Authworks WhatsApp sign-in code is 123456." }),
      { ...options, purpose: "sign-in" },
    ),
  ).toBe(true)
  expect(liveWhatsappMessageEventMatches(liveWhatsappMessageEventCreate({ to: "me" }), options)).toBe(true)
})

test("rejects outgoing, unrelated, wrong-recipient, and stale recipient messages", () => {
  const options = liveWhatsappMessageMatchOptionsCreate(2_000, "registration")
  const rejectedEvents = [
    liveWhatsappMessageEventCreate({ fromMe: true }),
    liveWhatsappMessageEventCreate({ body: "123456" }),
    liveWhatsappMessageEventCreate({ to: "other-recipient@c.us" }),
    liveWhatsappMessageEventCreate({ timestamp: 1_999 }),
    liveWhatsappMessageEventCreate({ session: "delivery-session" }),
  ]

  for (const event of rejectedEvents) expect(liveWhatsappMessageEventMatches(event, options)).toBe(false)
})

test("requires recipient observer readiness before continuing to a send", async () => {
  let closeCalls = 0
  const observation = {
    notBeforeTimestamp: 2_000,
    observer: {
      event: Promise.resolve({ errorMessage: "not used", op: "test", success: false as const }),
      ready: Promise.resolve({ data: undefined, success: true as const }),
      close: () => {
        closeCalls++
      },
    },
  } satisfies LiveWhatsappMessageObservation

  await expect(liveWhatsappMessageObservationReady(observation)).resolves.toEqual({ data: undefined, success: true })
  expect(closeCalls).toBe(0)
})

test("closes a recipient observer that is not ready", async () => {
  let closeCalls = 0
  const observation = {
    notBeforeTimestamp: 2_000,
    observer: {
      event: Promise.resolve({ errorMessage: "not used", op: "test", success: false as const }),
      ready: Promise.resolve({ errorMessage: "not ready", op: "test", success: false as const }),
      close: () => {
        closeCalls++
      },
    },
  } satisfies LiveWhatsappMessageObservation

  await expect(liveWhatsappMessageObservationReady(observation)).resolves.toEqual({
    errorMessage: "The WAHA recipient observer failed before becoming ready.",
    success: false,
  })
  expect(closeCalls).toBe(1)
})

test("reports tenant-resolution failures with a stable redacted phase", () => {
  expect(() =>
    liveTestResultRequire({ errorMessage: "Realm listing failed.", success: false }, "tenant-resolution"),
  ).toThrow("WhatsApp live test failed [tenant-resolution]: Realm listing failed.")
})

test("selects exactly one active realm by the Authworks hostname", () => {
  const realms = [
    { domains: ["other.example"], id: "other", status: "active" },
    { domains: ["LOGIN.EXAMPLE.COM"], id: "active", status: "active" },
    { domains: ["login.example.com"], id: "disabled", status: "disabled" },
  ] satisfies readonly LiveTestRealmCandidate[]

  expect(liveTestRealmSelect(realms, "login.example.com")).toMatchObject({ data: { id: "active" }, success: true })
  expect(liveTestRealmSelect(realms, "missing.example.com")).toMatchObject({ success: false })
  expect(
    liveTestRealmSelect(
      [...realms, { domains: ["login.example.com"], id: "second-active", status: "active" }],
      "login.example.com",
    ),
  ).toMatchObject({ success: false })
})

test("uses the public organization discovery result before privileged realm listing", async () => {
  const realmId = "018f0f4e-7b33-7a2c-8d1e-4f1d8a2b3c4d"
  const organizationId = "12345"
  const calls: string[] = []
  const organizations: LiveTestOrganizationApi = {
    organizationTenantDomainDiscover: async (hostname) => {
      calls.push(`discover:${hostname}`)
      return { data: liveTestOrganizationDiscoveryFoundCreate(realmId, organizationId), success: true }
    },
  }
  const realms: LiveTestRealmApi = {
    realmList: async () => {
      calls.push("realm-list")
      throw new Error("privileged realm listing must not run when discovery finds an organization")
    },
  }

  await expect(
    liveTestTenantResolve({ authworksBaseUrl: "https://LOGIN.EXAMPLE.COM/", organizations, realms }),
  ).resolves.toEqual({ data: { organizationId, realmId }, success: true })
  expect(calls).toEqual(["discover:login.example.com"])
})

test("falls back to privileged paged realm listing only when public discovery finds nothing", async () => {
  const realmId = "018f0f4e-7b33-7a2c-8d1e-4f1d8a2b3c4d"
  const calls: string[] = []
  const organizations: LiveTestOrganizationApi = {
    organizationTenantDomainDiscover: async (hostname) => {
      calls.push(`discover:${hostname}`)
      return { data: { found: false }, success: true }
    },
  }
  const realms: LiveTestRealmApi = {
    realmList: async (query) => {
      calls.push(`realm-list:${query?.pageToken ?? "first"}`)
      if (query?.pageToken === undefined)
        return {
          data: {
            items: [liveTestRealmCreate("018f0f4e-7b33-7a2c-8d1e-4f1d8a2b3c4e", "other.example.com")],
            nextPageToken: "next-page",
          },
          success: true,
        }
      return {
        data: { items: [liveTestRealmCreate(realmId, "login.example.com")] },
        success: true,
      }
    },
  }

  await expect(
    liveTestTenantResolve({ authworksBaseUrl: "https://login.example.com", organizations, realms }),
  ).resolves.toEqual({ data: { realmId }, success: true })
  expect(calls).toEqual(["discover:login.example.com", "realm-list:first", "realm-list:next-page"])
})

test("redacts public discovery errors without attempting privileged fallback", async () => {
  const organizations: LiveTestOrganizationApi = {
    organizationTenantDomainDiscover: async () => ({
      errorMessage: "private discovery error",
      op: "test",
      success: false,
    }),
  }
  const realms: LiveTestRealmApi = {
    realmList: async () => {
      throw new Error("privileged realm listing must not run after a discovery error")
    },
  }

  await expect(
    liveTestTenantResolve({ authworksBaseUrl: "https://login.example.com", organizations, realms }),
  ).resolves.toEqual({ errorMessage: "Organization discovery failed.", success: false })
  expect(() =>
    liveTestResultRequire({ errorMessage: "Organization discovery failed.", success: false }, "tenant-resolution"),
  ).toThrow("WhatsApp live test failed [tenant-resolution]: Organization discovery failed.")
})

test("only includes a public organization after its discovery response validates", () => {
  expect(liveTestOrganizationResolve({ found: false })).toEqual({ data: undefined, success: true })
  expect(
    liveTestOrganizationResolve(
      liveTestOrganizationDiscoveryFoundCreate("018f0f4e-7b33-7a2c-8d1e-4f1d8a2b3c4d", "12345"),
    ),
  ).toEqual({
    data: { organizationId: "12345", realmId: "018f0f4e-7b33-7a2c-8d1e-4f1d8a2b3c4d" },
    success: true,
  })
  expect(
    liveTestOrganizationResolve({
      found: true,
      organization: { id: "organization", name: "Tenant", realmId: "other-realm" },
    }),
  ).toEqual({ errorMessage: "Organization discovery failed.", success: false })
  expect(liveTestOrganizationResolve({ found: true })).toEqual({
    errorMessage: "Organization discovery failed.",
    success: false,
  })
})

function liveTestOptInIsEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true"
}

function liveTestResultRequire<T>(result: LiveTestResult<T>, phase: string): T {
  if (!result.success) throw liveTestPhaseErrorCreate(phase, result.errorMessage)
  return result.data
}

function liveTestApiResultRequire<T>(
  result: { readonly data: T; readonly success: true } | { readonly success: false },
  phase: string,
): T {
  if (!result.success) throw liveTestPhaseErrorCreate(phase)
  return result.data
}

function liveTestPhaseErrorCreate(phase: string, detail?: string): Error {
  return new Error(
    detail === undefined ? `WhatsApp live test failed [${phase}].` : `WhatsApp live test failed [${phase}]: ${detail}`,
  )
}

function liveTestFailureRedact(error: unknown): Error {
  if (error instanceof Error && error.message.startsWith("WhatsApp live test failed [")) return error
  return liveTestPhaseErrorCreate("execution")
}

function liveTestConfigurationParse(env: Record<string, string | undefined>): LiveTestResult<LiveTestConfiguration> {
  const missing = requiredEnvironmentNames.filter((name) => {
    const value = env[name]
    return value === undefined || value.trim().length === 0
  })
  if (missing.length > 0)
    return { errorMessage: `Missing required live-test environment: ${missing.join(", ")}`, success: false }

  const authworksBaseUrl = env.AUTHWORKS_URL
  const systemToken = env.AUTHWORKS_SYSTEM_SECRET
  if (authworksBaseUrl === undefined || systemToken === undefined)
    return { errorMessage: "Required Authworks live-test environment is unavailable.", success: false }
  const localOnly = liveTestOptInIsEnabled(env.AUTHWORKS_WA_LOCAL)
  if (!liveUrlIsAllowed(authworksBaseUrl, localOnly)) {
    return {
      errorMessage: localOnly
        ? "AUTHWORKS_URL must be a local HTTP(S) URL when AUTHWORKS_WA_LOCAL is enabled."
        : "AUTHWORKS_URL must use HTTPS.",
      success: false,
    }
  }

  const wahaRecipientRaw = env.WAHA_RECIPIENT
  if (wahaRecipientRaw === undefined)
    return { errorMessage: "Required live-test environment is unavailable.", success: false }
  const wahaRecipientResult = liveWahaRecipientConfigurationParse(wahaRecipientRaw, localOnly)
  if (!wahaRecipientResult.success) return wahaRecipientResult

  return {
    data: {
      authworksBaseUrl,
      systemToken,
      recipient: wahaRecipientResult.data,
    },
    success: true,
  }
}

async function liveTestTenantResolve(options: {
  readonly authworksBaseUrl: string
  readonly organizations: LiveTestOrganizationApi
  readonly realms: LiveTestRealmApi
}): Promise<LiveTestResult<LiveTestTenant>> {
  let hostname: string
  try {
    hostname = liveHostnameNormalize(new URL(options.authworksBaseUrl).hostname)
  } catch {
    return { errorMessage: "AUTHWORKS_URL has no usable hostname.", success: false }
  }
  if (hostname.length === 0) return { errorMessage: "AUTHWORKS_URL has no usable hostname.", success: false }

  try {
    const discoveryResult = await options.organizations.organizationTenantDomainDiscover(hostname)
    if (!discoveryResult.success) return { errorMessage: "Organization discovery failed.", success: false }
    const organizationResult = liveTestOrganizationResolve(discoveryResult.data)
    if (!organizationResult.success) return organizationResult
    if (organizationResult.data !== undefined) return { data: organizationResult.data, success: true }

    const realmsResult = await liveTestRealmListAll(options.realms)
    if (!realmsResult.success) return realmsResult
    const realmResult = liveTestRealmSelect(realmsResult.data, hostname)
    if (!realmResult.success) return realmResult

    return { data: { realmId: realmResult.data.id }, success: true }
  } catch {
    return { errorMessage: "Authworks tenant resolution failed.", success: false }
  }
}

async function liveTestRealmListAll(api: LiveTestRealmApi): Promise<LiveTestResult<readonly LiveTestRealmCandidate[]>> {
  const realms: LiveTestRealmCandidate[] = []
  const pageTokens = new Set<string>()
  let pageToken: string | undefined
  for (;;) {
    let listed: Awaited<ReturnType<typeof api.realmList>>
    try {
      listed = await api.realmList({ pageSize: 100, ...(pageToken === undefined ? {} : { pageToken }) })
    } catch {
      return { errorMessage: "Realm listing failed.", success: false }
    }
    if (!listed.success) return { errorMessage: "Realm listing failed.", success: false }
    realms.push(...listed.data.items)
    pageToken = listed.data.nextPageToken
    if (pageToken === undefined) return { data: realms, success: true }
    if (pageTokens.has(pageToken))
      return { errorMessage: "Realm listing returned a repeated page token.", success: false }
    pageTokens.add(pageToken)
  }
}

function liveTestRealmSelect(
  realms: readonly LiveTestRealmCandidate[],
  hostname: string,
): LiveTestResult<LiveTestRealmCandidate> {
  const normalizedHostname = liveHostnameNormalize(hostname)
  const matches = realms.filter(
    (realm) =>
      realm.status === "active" && realm.domains.some((domain) => liveHostnameNormalize(domain) === normalizedHostname),
  )
  if (matches.length === 0) return { errorMessage: "No active realm matches AUTHWORKS_URL.", success: false }
  if (matches.length > 1) return { errorMessage: "Multiple active realms match AUTHWORKS_URL.", success: false }
  const realm = matches[0]
  if (realm === undefined) return { errorMessage: "No active realm matches AUTHWORKS_URL.", success: false }
  return { data: realm, success: true }
}

function liveTestOrganizationResolve(discovery: unknown): LiveTestResult<LiveTestTenant | undefined> {
  const parsed = v.safeParse(organizationDiscoveryResponseSchema, discovery)
  if (!parsed.success) return { errorMessage: "Organization discovery failed.", success: false }
  if (!parsed.output.found) return { data: undefined, success: true }
  const organization: LiveTestOrganizationCandidate = parsed.output.organization
  return { data: { organizationId: organization.id, realmId: organization.realmId }, success: true }
}

function liveTestOrganizationDiscoveryFoundCreate(
  realmId: string,
  organizationId: string,
): Extract<OrganizationDiscoveryResponse, { found: true }> {
  return {
    branding: {
      dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
      disableWatermark: true,
      light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
      themeMode: "system",
    },
    domain: "login.example.com",
    found: true,
    organization: { id: organizationId, name: "Tenant", realmId },
    policy: {
      allowDomainDiscovery: true,
      allowEmailOtp: true,
      allowExternalIdentity: true,
      allowExternalIdentityAutoLinking: true,
      allowPassword: true,
      allowPasswordRecovery: true,
      allowPasskey: true,
      allowRegistration: true,
      allowWhatsappOtp: true,
      allowedFactors: ["totp"],
      minimumStepUpAssurance: "authenticated",
      preferredFactorOrder: ["totp"],
      providerIds: [],
      requiredMfa: false,
    },
    providers: [],
  }
}

function liveTestRealmCreate(id: string, domain: string): Realm {
  return { createdAt: 0, domain, domains: [domain], id, name: "Realm", status: "active", updatedAt: 0 }
}

function liveHostnameNormalize(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "")
}

function liveWahaRecipientConfigurationParse(
  raw: string,
  localOnly: boolean,
): LiveTestResult<LiveWahaRecipientConfiguration> {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return { errorMessage: "WAHA_RECIPIENT must be a JSON object with a session.", success: false }
  }

  const parsed = v.safeParse(wahaRecipientInputSchema, parsedJson)
  if (!parsed.success) return { errorMessage: "WAHA_RECIPIENT must be a JSON object with a session.", success: false }

  const configResult = liveWahaClientConfigParse(
    {
      baseUrl: parsed.output.baseUrl,
      ...(parsed.output.apiKey === undefined ? {} : { apiKey: parsed.output.apiKey }),
      ...(parsed.output.retries === undefined ? {} : { retries: parsed.output.retries }),
      session: parsed.output.session,
      ...(parsed.output.timeoutMs === undefined ? {} : { timeoutMs: parsed.output.timeoutMs }),
    },
    localOnly,
    "WAHA_RECIPIENT",
  )
  if (!configResult.success) return configResult
  return { data: { config: configResult.data, session: parsed.output.session }, success: true }
}

function liveWahaClientConfigParse(
  input: WahaClientConfigInput,
  localOnly: boolean,
  environmentName: "WAHA_RECIPIENT",
): LiveTestResult<WahaClientConfig> {
  const configResult = wahaClientConfig(input)
  if (!configResult.success)
    return { errorMessage: `${environmentName} contains an invalid WAHA client configuration.`, success: false }
  if (liveUrlIsAllowed(configResult.data.baseUrl, localOnly)) return configResult
  if (localOnly)
    return {
      errorMessage: `${environmentName} must contain only local HTTP(S) endpoints when AUTHWORKS_WA_LOCAL is enabled.`,
      success: false,
    }
  return { errorMessage: `${environmentName} must contain only HTTPS endpoints.`, success: false }
}

function liveWahaIdentityPhoneNumberNormalize(identity: MeInfo): string | undefined {
  const idPhoneNumber = liveWahaIdentityIdPhoneNumberNormalize(identity.id)
  if (idPhoneNumber === undefined) return undefined
  if (identity.jid === undefined) return idPhoneNumber
  const jidPhoneNumber = liveWahaIdentityJidPhoneNumberNormalize(identity.jid)
  if (jidPhoneNumber === undefined || jidPhoneNumber !== idPhoneNumber) return undefined
  return idPhoneNumber
}

function liveWahaIdentityIdPhoneNumberNormalize(value: string): string | undefined {
  const normalizedValue = value.trim()
  const canonicalIdMatch = /^([1-9][0-9]{0,14})@c\.us$/.exec(normalizedValue)
  if (canonicalIdMatch?.[1] !== undefined) return `+${canonicalIdMatch[1]}`
  if (/^[1-9][0-9]{0,14}$/.test(normalizedValue)) return `+${normalizedValue}`
  if (/^\+[1-9][0-9]{0,14}$/.test(normalizedValue)) return normalizedValue
  return undefined
}

function liveWahaIdentityJidPhoneNumberNormalize(value: string): string | undefined {
  const jidMatch = /^([1-9][0-9]{0,14}):([0-9]+)@s\.whatsapp\.net$/.exec(value.trim())
  if (jidMatch?.[1] !== undefined) return `+${jidMatch[1]}`
  return undefined
}

async function liveWhatsappRecipientResolve(
  recipient: LiveWahaRecipientConfiguration,
): Promise<LiveTestResult<LiveWhatsappRecipient>> {
  try {
    const identityResult = await sessionMe({ config: recipient.config, session: recipient.session })
    if (!identityResult.success || identityResult.data === null)
      return { errorMessage: "Configured WAHA recipient session is not authorized or has no identity.", success: false }

    const recipientPhoneNumber = liveWahaIdentityPhoneNumberNormalize(identityResult.data)
    if (recipientPhoneNumber === undefined)
      return {
        errorMessage: "Configured WAHA recipient session identity is not a canonical E.164 number.",
        success: false,
      }

    return {
      data: {
        recipientChatId: `${recipientPhoneNumber.slice(1)}@c.us`,
        recipientPhoneNumber,
      },
      success: true,
    }
  } catch {
    return { errorMessage: "Configured WAHA recipient session identity could not be read.", success: false }
  }
}

function liveUrlIsAllowed(value: string, localOnly: boolean): boolean {
  try {
    const url = new URL(value)
    if (url.username.length > 0 || url.password.length > 0) return false
    if (localOnly) return liveUrlIsLocal(url) && (url.protocol === "http:" || url.protocol === "https:")
    return url.protocol === "https:"
  } catch {
    return false
  }
}

function liveUrlIsLocal(url: URL): boolean {
  const hostname = url.hostname.toLowerCase()
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]"
}

function liveTestAccountCreate(): LiveTestAccount {
  const suffix = `${Date.now()}-${crypto.randomUUID()}`
  return {
    email: `authworks-whatsapp-live-${suffix}@example.invalid`,
    password: `Authworks-${crypto.randomUUID()}-a1!`,
    userName: `authworks-whatsapp-live-${suffix}`,
  }
}

function whatsappOtpMessageCodeParse(body: string | undefined, purpose: WhatsappOtpMessagePurpose): string | undefined {
  const pattern =
    purpose === "registration"
      ? /^Your Authworks registration verification code is ([0-9]{6})\.$/
      : /^Your Authworks WhatsApp sign-in code is ([0-9]{6})\.$/
  return pattern.exec(body ?? "")?.[1]
}

function liveWhatsappMessageMatchOptionsCreate(
  notBeforeTimestamp: number,
  purpose: WhatsappOtpMessagePurpose,
): LiveWhatsappMessageMatchOptions {
  return {
    notBeforeTimestamp,
    purpose,
    recipientChatId: "15551234567@c.us",
    recipientSession: "authorized-recipient",
  }
}

function liveWhatsappMessageEventCreate(
  overrides: Partial<WAMessage> & { readonly event?: string; readonly session?: string } = {},
): WahaWebSocketEvent<WAMessage> {
  const { event, session, ...messageOverrides } = overrides
  return {
    event: event ?? "message",
    payload: {
      body: "Your Authworks registration verification code is 123456.",
      from: "15550000000@c.us",
      fromMe: false,
      id: "inbound-message-id",
      timestamp: 2_000,
      to: "15551234567@c.us",
      ...messageOverrides,
    },
    session: session ?? "authorized-recipient",
  }
}

function liveWhatsappMessageObservationCreate(options: {
  readonly recipient: LiveWahaRecipientConfiguration
  readonly purpose: WhatsappOtpMessagePurpose
  readonly recipientChatId: string
}): LiveWhatsappMessageObservation {
  const notBeforeTimestamp = Math.floor(Date.now() / 1_000)
  return {
    notBeforeTimestamp,
    observer: wahaWebSocketObserve<WAMessage>({
      config: options.recipient.config,
      events: ["message"],
      payloadSchema: wahaMessagePayloadSchema,
      predicate: (event: WahaWebSocketEvent<WAMessage>) =>
        liveWhatsappMessageEventMatches(event, {
          notBeforeTimestamp,
          purpose: options.purpose,
          recipientChatId: options.recipientChatId,
          recipientSession: options.recipient.session,
        }),
      session: options.recipient.session,
    }),
  }
}

function liveWhatsappMessageEventMatches(
  event: WahaWebSocketEvent<WAMessage>,
  options: LiveWhatsappMessageMatchOptions,
): boolean {
  if (event.event !== "message" || event.session !== options.recipientSession) return false
  const message = event.payload
  if (message.fromMe || message.from === options.recipientChatId) return false
  if (message.to !== "me" && message.to !== options.recipientChatId) return false
  if (message.timestamp < options.notBeforeTimestamp) return false
  return whatsappOtpMessageCodeParse(message.body, options.purpose) !== undefined
}

async function liveWhatsappMessageObservationReady(
  observation: LiveWhatsappMessageObservation,
): Promise<LiveTestResult<void>> {
  try {
    const ready = await observation.observer.ready
    if (ready.success) return { data: undefined, success: true }
  } catch {
    // Return the redacted phase error below.
  }
  observation.observer.close()
  return { errorMessage: "The WAHA recipient observer failed before becoming ready.", success: false }
}

async function liveWhatsappMessageObservationEventAwait(
  observation: LiveWhatsappMessageObservation,
): Promise<LiveTestResult<WahaWebSocketEvent<WAMessage>>> {
  try {
    const result = await observation.observer.event
    if (result.success) return result
  } catch {
    // Return the redacted phase error below.
  }
  return { errorMessage: "WAHA recipient message observation failed.", success: false }
}

async function liveTestCleanup(options: {
  readonly account: LiveTestAccount
  readonly realmId: string
  readonly registrationAccepted: boolean
  readonly registrationObservation: LiveWhatsappMessageObservation | undefined
  readonly signInObservation: LiveWhatsappMessageObservation | undefined
  readonly systemUsers: ReturnType<typeof userApiClientCreate>
  readonly testUserId: string | undefined
}): Promise<readonly string[]> {
  const errors: string[] = []
  for (const observation of [options.registrationObservation, options.signInObservation]) {
    if (observation === undefined) continue
    try {
      observation.observer.close()
    } catch {
      errors.push("WAHA observer cleanup failed.")
    }
  }

  let cleanupUserId = options.testUserId
  if (cleanupUserId === undefined) {
    const lookup = await liveTestUserIdFind(
      options.systemUsers,
      options.realmId,
      options.account.userName,
      options.account.email,
    )
    if (!lookup.success) {
      errors.push("Cleanup user lookup failed.")
      return errors
    }
    cleanupUserId = lookup.data
  }

  if (cleanupUserId === undefined) {
    if (options.registrationAccepted) errors.push("Cleanup user lookup found no matching user.")
    return errors
  }

  try {
    const deleted = await options.systemUsers.userDelete(options.realmId, cleanupUserId)
    if (!deleted.success) errors.push("Cleanup user deletion failed.")
  } catch {
    errors.push("Cleanup user deletion failed.")
  }
  return errors
}

async function liveTestUserIdFind(
  users: ReturnType<typeof userApiClientCreate>,
  realmId: string,
  userName: string,
  email: string,
): Promise<LiveTestResult<string | undefined>> {
  try {
    let pageToken: string | undefined
    for (;;) {
      const listed = await users.userList(realmId, {
        pageSize: 100,
        ...(pageToken === undefined ? {} : { pageToken }),
      })
      if (!listed.success) return { errorMessage: "User lookup failed.", success: false }
      const matchingUser = listed.data.items.find((user) => user.userName === userName && user.email === email)
      if (matchingUser !== undefined) return { data: matchingUser.id, success: true }
      if (listed.data.nextPageToken === undefined || listed.data.nextPageToken === pageToken)
        return { data: undefined, success: true }
      pageToken = listed.data.nextPageToken
    }
  } catch {
    return { errorMessage: "User lookup failed.", success: false }
  }
}
