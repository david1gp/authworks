import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serverApplicationCreate } from "../../src/compositions/serverApplicationCreate.js"
import { mailDeliveryPortFakeCreate } from "../../src/features/email/domain/mailDeliveryPortFakeCreate.js"
import { emailPreviewFooterFixture } from "../../src/features/email/fixtures/emailPreviewFooterFixture.js"
import { emailOtpApiClientCreate } from "../../src/features/emailOtp/client/emailOtpApiClientCreate.js"
import { organizationApiClientCreate } from "../../src/features/organizations/client/organizationApiClientCreate.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"

type RenderRequest = {
  readonly body: Record<string, unknown>
  readonly path: string
}

function emailGeneratorFetchCreate(requests: RenderRequest[]) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = new Request(typeof input === "string" ? input : input instanceof URL ? input : input.url, init)
    const body = (await request.json()) as Record<string, unknown>
    const path = new URL(request.url).pathname
    requests.push({ body, path })
    return Response.json({
      html: `<main data-template="${path}">${String(body.code ?? body.entityName)}</main>`,
      subject: `Authworks ${path}`,
      text: `Rendered ${String(body.code ?? body.entityName)}`,
    })
  }
}

async function queuedDeliveryFlush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

test("composed server renders and delivers verification, recovery, OTP, and invitation messages", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-email-delivery-"))
  const domain = "email-delivery.example.com"
  const systemSecret = "email-delivery-system-secret"
  const requests: RenderRequest[] = []
  const fakeMail = mailDeliveryPortFakeCreate()
  try {
    const created = serverApplicationCreate({
      databasePath: join(directory, "authworks.sqlite"),
      emailGenerator: {
        baseUrl: "https://email-generator.example.test",
        fetch: emailGeneratorFetchCreate(requests),
        footer: emailPreviewFooterFixture,
        invitationSender: { email: "admin@example.com", name: "Delivery Administrator" },
      },
      mailDelivery: fakeMail.port,
      publicOrigin: `https://${domain}`,
      systemSecret,
    })
    expect(created.success).toBe(true)
    if (!created.success) return
    const fetchFromServer = async (input: string | URL | Request, init?: RequestInit) =>
      created.data.request(input instanceof Request ? input : input.toString(), init)
    const baseUrl = `https://${domain}`
    const system = { baseUrl, fetch: fetchFromServer, token: systemSecret }

    const realms = realmApiClientCreate(system)
    const realm = await realms.realmCreate({ domain, name: "Email delivery" })
    expect(realm.success).toBe(true)
    if (!realm.success) return

    const passwords = passwordApiClientCreate({ baseUrl, fetch: fetchFromServer })
    const registered = await passwords.passwordRegister(realm.data.realm.id, {
      email: "member@example.com",
      password: "Correct Horse 12",
      profile: { displayName: "Delivery Member" },
      userName: "delivery-member",
    })
    expect(registered.success).toBe(true)
    await queuedDeliveryFlush()
    expect(requests[0]?.path).toBe("/renderEmailTemplate/signUpV1")
    expect(requests[0]?.body.url).toContain(`/login/verify-email?realmId=${realm.data.realm.id}&token=`)
    expect(fakeMail.messages[0]?.to).toBe("member@example.com")

    const verificationToken = String(requests[0]?.body.code)
    expect((await passwords.passwordEmailVerify(realm.data.realm.id, { token: verificationToken })).success).toBe(true)

    expect(
      (await passwords.passwordRecoveryRequest(realm.data.realm.id, { email: "member@example.com" })).success,
    ).toBe(true)
    await queuedDeliveryFlush()
    expect(requests[1]?.path).toBe("/renderEmailTemplate/passwordChangeV1")
    expect(requests[1]?.body.url).toContain(`/login/password/reset?realmId=${realm.data.realm.id}&token=`)
    expect(fakeMail.messages[1]?.to).toBe("member@example.com")

    const emailOtp = emailOtpApiClientCreate({ baseUrl, fetch: fetchFromServer })
    expect((await emailOtp.emailOtpStart(realm.data.realm.id, { email: "member@example.com" })).success).toBe(true)
    await queuedDeliveryFlush()
    expect(requests[2]?.path).toBe("/renderEmailTemplate/signInV1")
    expect(requests[2]?.body.url).toBe(`https://${domain}/login/otp?realmId=${realm.data.realm.id}`)
    expect(fakeMail.messages[2]?.to).toBe("member@example.com")

    const organizations = organizationApiClientCreate(system)
    const organization = await organizations.organizationCreate(realm.data.realm.id, { name: "Delivery Organization" })
    expect(organization.success).toBe(true)
    if (!organization.success) return
    const invitation = await organizations.organizationInvitationCreate(
      realm.data.realm.id,
      organization.data.organization.id,
      {
        email: "invitee@example.com",
        roles: ["member"],
      },
    )
    expect(invitation.success).toBe(true)
    if (!invitation.success) return
    await queuedDeliveryFlush()
    expect(requests[3]?.path).toBe("/renderEmailTemplate/orgInvitationV1")
    expect(requests[3]?.body).toMatchObject({
      entity: "organization",
      invitedByEmail: "admin@example.com",
      invitedByName: "Delivery Administrator",
      url: `https://${domain}/invitations/accept?token=${encodeURIComponent(invitation.data.token)}`,
    })
    expect(fakeMail.messages[3]?.to).toBe("invitee@example.com")
    expect(fakeMail.messages.map(({ message }) => message.html)).toEqual([
      expect.stringContaining("/renderEmailTemplate/signUpV1"),
      expect.stringContaining("/renderEmailTemplate/passwordChangeV1"),
      expect.stringContaining("/renderEmailTemplate/signInV1"),
      expect.stringContaining("/renderEmailTemplate/orgInvitationV1"),
    ])
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})
