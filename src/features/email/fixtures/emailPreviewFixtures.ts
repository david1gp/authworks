import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import type { EmailRenderedMessage } from "../public/emailRenderedMessageSchema.js"
import { emailOtpPreviewFixture } from "./emailOtpPreviewFixture.js"
import { emailOtpSecurityFailedPreviewFixture } from "./emailOtpSecurityFailedPreviewFixture.js"
import { emailOtpSecurityRequestedPreviewFixture } from "./emailOtpSecurityRequestedPreviewFixture.js"
import { emailOtpSecurityVerifiedPreviewFixture } from "./emailOtpSecurityVerifiedPreviewFixture.js"
import { emailRecoveryPreviewFixture } from "./emailRecoveryPreviewFixture.js"
import { emailVerificationPreviewFixture } from "./emailVerificationPreviewFixture.js"
import { impersonationEndedPreviewFixture } from "./impersonationEndedPreviewFixture.js"
import { impersonationStartedPreviewFixture } from "./impersonationStartedPreviewFixture.js"
import { organizationInvitationPreviewFixture } from "./organizationInvitationPreviewFixture.js"

type EmailPreviewFixture = {
  readonly contract: string
  readonly id:
    | "verification"
    | "otp"
    | "recovery"
    | "organization-invitation"
    | "security-requested"
    | "security-verified"
    | "security-failed"
    | "impersonation-started"
    | "impersonation-ended"
  readonly message: EmailRenderedMessage
  readonly recipient: string
  readonly titleKey: MessageKey
}

function emailPreviewHtmlCreate(eyebrow: string, heading: string, copy: string, action?: string, url?: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">
<style>body{margin:0;background:#f4f7fb;color:#162033;font:16px/1.55 system-ui,sans-serif}.shell{padding:32px 16px}.card{max-width:560px;margin:auto;overflow:hidden;border:1px solid #dbe4f0;border-radius:18px;background:#fff;box-shadow:0 12px 35px #20335418}.brand{padding:24px 32px;background:linear-gradient(135deg,#eef6ff,#f1efff);font-weight:750;color:#155eef}.content{padding:36px 32px}.eyebrow{margin:0 0 8px;color:#155eef;font-size:12px;font-weight:750;letter-spacing:.12em;text-transform:uppercase}h1{margin:0 0 14px;font-size:28px;line-height:1.2}p{margin:0 0 24px;color:#526071}.button{display:inline-block;border-radius:10px;background:#155eef;color:#fff!important;padding:12px 18px;text-decoration:none;font-weight:700}.footer{padding:22px 32px;border-top:1px solid #edf1f7;color:#718096;font-size:12px}@media(max-width:480px){.shell{padding:12px}.content,.brand,.footer{padding-left:22px;padding-right:22px}h1{font-size:24px}}</style></head>
 <body><div class="shell"><main class="card"><div class="brand">Authworks</div><section class="content"><p class="eyebrow">${eyebrow}</p><h1>${heading}</h1><p>${copy}</p>${action === undefined || url === undefined ? "" : `<a class="button" href="${url}">${action}</a>`}</section><footer class="footer">Authworks preview · Secure identity</footer></main></div></body></html>`
}

export const emailPreviewFixtures = [
  {
    contract: "EmailVerificationRenderRequest",
    id: "verification",
    message: {
      subject: "Verify your email address",
      text: `Welcome to Authworks. Verify your email address by opening ${emailVerificationPreviewFixture.url}\n\nIf you did not request this, you can ignore this email.`,
      html: emailPreviewHtmlCreate(
        "Email verification",
        "Verify your email address",
        "Confirm this address to finish setting up your Authworks account.",
        "Verify email",
        emailVerificationPreviewFixture.url,
      ),
    },
    recipient: emailVerificationPreviewFixture.delivery.email,
    titleKey: "email.preview.verification",
  },
  {
    contract: "EmailOtpRenderRequest",
    id: "otp",
    message: {
      subject: "Your sign-in code is 123456",
      text: `Your Authworks sign-in code is ${emailOtpPreviewFixture.delivery.code}. It expires soon. Do not share this code.`,
      html: emailPreviewHtmlCreate(
        "One-time password",
        `Your sign-in code is ${emailOtpPreviewFixture.delivery.code}`,
        "Enter this one-time code to continue signing in. Do not share it with anyone.",
        "Return to sign in",
        emailOtpPreviewFixture.url,
      ),
    },
    recipient: emailOtpPreviewFixture.delivery.email,
    titleKey: "email.preview.otp",
  },
  {
    contract: "EmailRecoveryRenderRequest",
    id: "recovery",
    message: {
      subject: "Reset your password",
      text: `Reset your Authworks password by opening ${emailRecoveryPreviewFixture.url}\n\nIf you did not request a reset, you can ignore this email.`,
      html: emailPreviewHtmlCreate(
        "Account recovery",
        "Reset your password",
        "Use this secure link to choose a new password for your Authworks account.",
        "Reset password",
        emailRecoveryPreviewFixture.url,
      ),
    },
    recipient: emailRecoveryPreviewFixture.delivery.email,
    titleKey: "email.preview.recovery",
  },
  {
    contract: "OrganizationInvitationRenderRequest",
    id: "organization-invitation",
    message: {
      subject: `Join ${organizationInvitationPreviewFixture.delivery.entityName}`,
      text: `${organizationInvitationPreviewFixture.delivery.invitedByName} invited you to join ${organizationInvitationPreviewFixture.delivery.entityName}. Accept the invitation at ${organizationInvitationPreviewFixture.delivery.url}`,
      html: emailPreviewHtmlCreate(
        "Organization invitation",
        `Join ${organizationInvitationPreviewFixture.delivery.entityName}`,
        `${organizationInvitationPreviewFixture.delivery.invitedByName} invited you to collaborate in Authworks.`,
        "Accept invitation",
        organizationInvitationPreviewFixture.delivery.url,
      ),
    },
    recipient: organizationInvitationPreviewFixture.delivery.email,
    titleKey: "email.preview.invitation",
  },
  {
    contract: "EmailOtpSecurityNotificationRenderRequest",
    id: "security-requested",
    message: {
      subject: "Sign-in verification requested",
      text: `A sign-in verification code was requested for your Authworks account.\n\nChallenge: ${emailOtpSecurityRequestedPreviewFixture.notification.challengeId}`,
      html: emailPreviewHtmlCreate(
        "Account security",
        "Sign-in verification requested",
        "A sign-in verification code was requested for your Authworks account.",
      ),
    },
    recipient: "member@example.test",
    titleKey: "email.preview.securityRequested",
  },
  {
    contract: "EmailOtpSecurityNotificationRenderRequest",
    id: "security-verified",
    message: {
      subject: "Sign-in verification completed",
      text: `A sign-in verification code was accepted for your Authworks account.\n\nChallenge: ${emailOtpSecurityVerifiedPreviewFixture.notification.challengeId}`,
      html: emailPreviewHtmlCreate(
        "Account security",
        "Sign-in verification completed",
        "A sign-in verification code was accepted for your Authworks account.",
      ),
    },
    recipient: "member@example.test",
    titleKey: "email.preview.securityVerified",
  },
  {
    contract: "EmailOtpSecurityNotificationRenderRequest",
    id: "security-failed",
    message: {
      subject: "Sign-in verification failed",
      text: `A sign-in verification attempt failed. If this was not you, secure your account.\n\nAttempts: ${emailOtpSecurityFailedPreviewFixture.notification.attempts}`,
      html: emailPreviewHtmlCreate(
        "Account security",
        "Sign-in verification failed",
        "A sign-in verification attempt failed. If this was not you, secure your account.",
      ),
    },
    recipient: "member@example.test",
    titleKey: "email.preview.securityFailed",
  },
  {
    contract: "ImpersonationStartedRenderRequest",
    id: "impersonation-started",
    message: {
      subject: "Impersonation started",
      text: `An administrator started an impersonation session.\n\nActor: ${impersonationStartedPreviewFixture.notification.actorId}\nSubject: ${impersonationStartedPreviewFixture.notification.subjectId}\nSession: ${impersonationStartedPreviewFixture.notification.sessionId}`,
      html: emailPreviewHtmlCreate(
        "Account security",
        "Impersonation started",
        "An administrator started an impersonation session for your account. Review your realm audit events if this was unexpected.",
      ),
    },
    recipient: "member@example.test",
    titleKey: "email.preview.impersonationStarted",
  },
  {
    contract: "ImpersonationEndedRenderRequest",
    id: "impersonation-ended",
    message: {
      subject: "Impersonation ended",
      text: `An impersonation session has ended.\n\nSession: ${impersonationEndedPreviewFixture.notification.sessionId}\nEnded by: ${impersonationEndedPreviewFixture.notification.endedById}`,
      html: emailPreviewHtmlCreate(
        "Account security",
        "Impersonation ended",
        "An impersonation session for your account has ended.",
      ),
    },
    recipient: "member@example.test",
    titleKey: "email.preview.impersonationEnded",
  },
] as const satisfies readonly EmailPreviewFixture[]
