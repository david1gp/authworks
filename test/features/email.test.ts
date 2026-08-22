import { expect, test } from "bun:test"
import { emailGeneratorApiClientCreate } from "../../src/features/email/client/emailGeneratorApiClientCreate.js"
import { emailOtpSecurityFailedPreviewFixture } from "../../src/features/email/fixtures/emailOtpSecurityFailedPreviewFixture.js"
import { emailOtpSecurityRequestedPreviewFixture } from "../../src/features/email/fixtures/emailOtpSecurityRequestedPreviewFixture.js"
import { emailOtpSecurityVerifiedPreviewFixture } from "../../src/features/email/fixtures/emailOtpSecurityVerifiedPreviewFixture.js"
import { emailOtpPreviewFixture } from "../../src/features/email/fixtures/emailOtpPreviewFixture.js"
import { emailRecoveryPreviewFixture } from "../../src/features/email/fixtures/emailRecoveryPreviewFixture.js"
import { emailVerificationPreviewFixture } from "../../src/features/email/fixtures/emailVerificationPreviewFixture.js"
import { impersonationEndedPreviewFixture } from "../../src/features/email/fixtures/impersonationEndedPreviewFixture.js"
import { impersonationStartedPreviewFixture } from "../../src/features/email/fixtures/impersonationStartedPreviewFixture.js"
import { organizationInvitationPreviewFixture } from "../../src/features/email/fixtures/organizationInvitationPreviewFixture.js"

type CapturedRequest = {
  readonly body: Record<string, unknown>
  readonly path: string
}

function fakeEmailGeneratorFetchCreate(requests: CapturedRequest[]) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = new Request(typeof input === "string" ? input : input instanceof URL ? input : input.url, init)
    const body = (await request.json()) as Record<string, unknown>
    const path = new URL(request.url).pathname
    requests.push({ body, path })
    return Response.json({
      html: `<main data-template="${path}">${String(body.code ?? body.entityName ?? body.subject)}</main>`,
      subject: `Preview ${path}`,
      text: `Rendered ${String(body.code ?? body.entityName ?? body.subject)}`,
    })
  }
}

test("email generator adapter renders callback-compatible delivery fixtures through the fake HTTP server", async () => {
  const requests: CapturedRequest[] = []
  const client = emailGeneratorApiClientCreate({
    baseUrl: "https://email-generator.example.test",
    fetch: fakeEmailGeneratorFetchCreate(requests),
  })

  const [verification, otp, recovery, invitation, requested, verified, failed, started, ended] = await Promise.all([
    client.emailVerificationRender(emailVerificationPreviewFixture),
    client.emailOtpRender(emailOtpPreviewFixture),
    client.emailRecoveryRender(emailRecoveryPreviewFixture),
    client.organizationInvitationRender(organizationInvitationPreviewFixture),
    client.emailOtpSecurityNotificationRender(emailOtpSecurityRequestedPreviewFixture),
    client.emailOtpSecurityNotificationRender(emailOtpSecurityVerifiedPreviewFixture),
    client.emailOtpSecurityNotificationRender(emailOtpSecurityFailedPreviewFixture),
    client.impersonationStartedRender(impersonationStartedPreviewFixture),
    client.impersonationEndedRender(impersonationEndedPreviewFixture),
  ])

  expect(verification.success).toBe(true)
  expect(otp.success).toBe(true)
  expect(recovery.success).toBe(true)
  expect(invitation.success).toBe(true)
  expect(requested.success).toBe(true)
  expect(verified.success).toBe(true)
  expect(failed.success).toBe(true)
  expect(started.success).toBe(true)
  expect(ended.success).toBe(true)
  expect(requests.map(({ path }) => path).sort()).toEqual([
    "/renderEmailTemplate/orgInvitationV1",
    "/renderEmailTemplate/passwordChangeV1",
    "/renderEmailTemplate/securityNotificationV1",
    "/renderEmailTemplate/securityNotificationV1",
    "/renderEmailTemplate/securityNotificationV1",
    "/renderEmailTemplate/securityNotificationV1",
    "/renderEmailTemplate/securityNotificationV1",
    "/renderEmailTemplate/signInV1",
    "/renderEmailTemplate/signUpV1",
  ])

  const verificationRequest = requests.find(({ path }) => path.endsWith("signUpV1"))
  const otpRequest = requests.find(({ path }) => path.endsWith("signInV1"))
  const recoveryRequest = requests.find(({ path }) => path.endsWith("passwordChangeV1"))
  const invitationRequest = requests.find(({ path }) => path.endsWith("orgInvitationV1"))
  expect(verificationRequest?.body).toMatchObject({ code: emailVerificationPreviewFixture.delivery.token })
  expect(otpRequest?.body).toMatchObject({ code: emailOtpPreviewFixture.delivery.code })
  expect(recoveryRequest?.body).toMatchObject({ code: emailRecoveryPreviewFixture.delivery.token })
  expect(invitationRequest?.body).toMatchObject({
    entity: "organization",
    entityName: organizationInvitationPreviewFixture.delivery.entityName,
    invitedByEmail: organizationInvitationPreviewFixture.delivery.invitedByEmail,
    invitedByName: organizationInvitationPreviewFixture.delivery.invitedByName,
    invitedName: organizationInvitationPreviewFixture.delivery.invitedName,
  })
  expect(invitationRequest?.body.email).toBeUndefined()
  expect(verificationRequest?.body.l).toBe("en")
  expect(requests.filter(({ path }) => path.endsWith("securityNotificationV1"))).toHaveLength(5)

  if (
    !verification.success ||
    !otp.success ||
    !recovery.success ||
    !invitation.success ||
    !requested.success ||
    !verified.success ||
    !failed.success ||
    !started.success ||
    !ended.success
  )
    return
  expect(verification.data.html).toContain("signUpV1")
  expect(verification.data.text).toContain(emailVerificationPreviewFixture.delivery.token)
  expect(otp.data.html).toContain("signInV1")
  expect(recovery.data.html).toContain("passwordChangeV1")
  expect(invitation.data.html).toContain("orgInvitationV1")
  expect(requested.data.html).toContain("Sign-in verification requested")
  expect(verified.data.text).toContain("Sign-in verification completed")
  expect(failed.data.text).toContain("Sign-in verification failed")
  expect(started.data.html).toContain("Impersonation started")
  expect(ended.data.html).toContain("Impersonation ended")
})

test("email generator adapter rejects invalid callback payloads before calling the server", async () => {
  let calls = 0
  const client = emailGeneratorApiClientCreate({
    baseUrl: "https://email-generator.example.test",
    fetch: async () => {
      calls += 1
      return Response.json({})
    },
  })

  const result = await client.emailOtpRender({
    ...emailOtpPreviewFixture,
    delivery: { ...emailOtpPreviewFixture.delivery, code: "bad" },
  })

  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.code).toBe("email.invalid")
  expect(calls).toBe(0)
})

test("email generator adapter returns invalid-response for malformed renderer output", async () => {
  const client = emailGeneratorApiClientCreate({
    baseUrl: "https://email-generator.example.test",
    fetch: async () => Response.json({ subject: "missing text and html" }),
  })

  const result = await client.emailVerificationRender(emailVerificationPreviewFixture)

  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.code).toBe("platform.invalid-response")
})
