import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import type { adminUserSecurityStateCreate } from "./adminUserSecurityStateCreate.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"
import type { AdminViewStatus } from "./adminViewStatusSchema.js"

const authenticationMethodKeys: Readonly<Record<SessionAuthenticationMethod, MessageKey>> = {
  bootstrap_admin: "admin.signIn.title",
  email_otp: "login.chooser.emailOtpLabel",
  external_identity: "admin.organizations.policy.externalIdentity",
  impersonation: "admin.impersonation.title",
  passkey: "login.chooser.passkeyLabel",
  password: "login.chooser.passwordLabel",
  recovery_code: "login.mfa.recoveryCode",
  totp: "login.mfa.totp",
  whatsapp_otp: "login.chooser.emailOtpLabel",
}

const metaClass = "flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"

export function AdminUserSecurityView(props: { readonly state: ReturnType<typeof adminUserSecurityStateCreate> }) {
  return (
    <>
      <AuthenticatedSection
        description={messageTranslate("admin.users.sessions.description")}
        title={messageTranslate("admin.users.sessions.title")}
      >
        <Show when={props.state.notice()}>
          {(notice) => <AuthenticatedNotice class="mx-3 mt-2.5" message={notice()} />}
        </Show>
        <SecurityStateBoundary
          detail={props.state.sessionsError()}
          emptyTitle={messageTranslate("admin.users.sessions.empty")}
          onRetry={props.state.sessionsReload}
          status={props.state.sessionsStatus()}
        >
          <ul class="divide-y divide-line-subtle">
            <For each={props.state.sessions()}>
              {(session) => (
                <li
                  class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-3 py-2"
                  data-admin-user-session={session.id}
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="truncate text-sm font-medium">
                        {session.device.description ?? messageTranslate("account.sessions.unknownDevice")}
                      </h3>
                      <Show when={session.current}>
                        <AuthenticatedStatus label={messageTranslate("account.sessions.current")} tone="success" />
                      </Show>
                    </div>
                    <p class={`${metaClass} mt-1`}>
                      <span>{messageTranslate(authenticationMethodKeys[session.authenticationMethod])}</span>
                      <span>
                        {messageTranslate("admin.users.sessions.lastUsed")}:{" "}
                        {localeDateFormat(session.lastUsedAt, { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                      <span>
                        {messageTranslate("admin.users.sessions.expires")}:{" "}
                        {localeDateFormat(session.expiresAt, { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                      <Show when={session.device.ipAddress}>
                        {(ipAddress) => (
                          <span class="font-mono">
                            {messageTranslate("admin.users.sessions.ipAddress")}: {ipAddress()}
                          </span>
                        )}
                      </Show>
                    </p>
                  </div>
                  <Button
                    disabled={props.state.pendingSessionId() !== undefined}
                    onClick={() => void props.state.sessionRevoke(session.id)}
                    size="sm"
                    variant="outline"
                  >
                    {messageTranslate("account.sessions.revoke")}
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </SecurityStateBoundary>
      </AuthenticatedSection>

      <AuthenticatedSection
        description={messageTranslate("admin.users.authentication.description")}
        title={messageTranslate("admin.users.authentication.title")}
      >
        <SecurityStateBoundary
          detail={props.state.methodsError()}
          emptyTitle={messageTranslate("admin.users.authentication.empty")}
          onRetry={props.state.methodsReload}
          status={props.state.methodsStatus()}
        >
          <Show when={props.state.methods()}>
            {(methods) => (
              <ul class="divide-y divide-line-subtle">
                <MethodRow
                  detail={
                    methods().emailOtp.available
                      ? messageTranslate("account.status.available")
                      : messageTranslate("account.status.notConfigured")
                  }
                  title={messageTranslate("account.factors.emailOtp")}
                  tone={methods().emailOtp.available ? "success" : "neutral"}
                />
                <MethodRow
                  detail={messageTranslate("account.factors.passkeyCount", {
                    count: methods().passkeys.credentials.length,
                  })}
                  title={messageTranslate("account.factors.passkeys")}
                  tone={methods().passkeys.credentials.length > 0 ? "success" : "neutral"}
                >
                  <For each={methods().passkeys.credentials}>
                    {(credential) => (
                      <p class={metaClass}>
                        {messageTranslate("admin.users.authentication.passkeyMetadata", {
                          created: localeDateFormat(credential.createdAt, { dateStyle: "medium" }),
                          deviceType: credential.deviceType,
                          lastUsed:
                            credential.lastUsedAt === null
                              ? messageTranslate("admin.users.authentication.neverUsed")
                              : localeDateFormat(credential.lastUsedAt, { dateStyle: "medium", timeStyle: "short" }),
                        })}
                      </p>
                    )}
                  </For>
                </MethodRow>
                <MethodRow
                  detail={
                    methods().recoveryCodes.available
                      ? messageTranslate("admin.users.authentication.recoveryCount", {
                          count: methods().recoveryCodes.remaining,
                        })
                      : messageTranslate("account.status.notConfigured")
                  }
                  title={messageTranslate("admin.users.authentication.recoveryCodes")}
                  tone={methods().recoveryCodes.available ? "success" : "neutral"}
                >
                  <Show when={methods().recoveryCodes.generatedAt}>
                    {(generatedAt) => (
                      <p class={metaClass}>
                        {messageTranslate("admin.users.authentication.generated", {
                          date: localeDateFormat(generatedAt(), { dateStyle: "medium", timeStyle: "short" }),
                        })}
                      </p>
                    )}
                  </Show>
                </MethodRow>
                <MethodRow
                  detail={
                    methods().totp.enrolled
                      ? messageTranslate("account.status.configured")
                      : messageTranslate("account.status.notConfigured")
                  }
                  title={messageTranslate("account.factors.totp")}
                  tone={methods().totp.enrolled ? "success" : "neutral"}
                >
                  <For each={methods().totp.enrollments}>
                    {(enrollment) => (
                      <p class={metaClass}>
                        {messageTranslate("admin.users.authentication.totpMetadata", {
                          confirmed:
                            enrollment.confirmedAt === null
                              ? messageTranslate("admin.users.authentication.pending")
                              : localeDateFormat(enrollment.confirmedAt, { dateStyle: "medium", timeStyle: "short" }),
                          label: enrollment.label,
                        })}
                      </p>
                    )}
                  </For>
                </MethodRow>
              </ul>
            )}
          </Show>
        </SecurityStateBoundary>
      </AuthenticatedSection>
    </>
  )
}

function MethodRow(props: {
  readonly children?: unknown
  readonly detail: string
  readonly title: string
  readonly tone: "neutral" | "success"
}) {
  return (
    <li class="grid gap-1 px-3 py-2">
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 class="min-w-0 truncate text-sm font-medium">{props.title}</h3>
        <AuthenticatedStatus label={props.detail} tone={props.tone} />
      </div>
      {props.children as never}
    </li>
  )
}

function SecurityStateBoundary(props: {
  readonly children: unknown
  readonly detail?: string
  readonly emptyTitle: string
  readonly onRetry: () => void
  readonly status: AdminViewStatus
}) {
  return (
    <Show
      when={props.status === "ready"}
      fallback={
        <ProductionStatePanel
          compact
          detail={props.detail}
          onRetry={props.status === "error" ? props.onRetry : undefined}
          state={adminViewStatusPanelState(props.status)}
          title={props.status === "empty" ? props.emptyTitle : undefined}
        />
      }
    >
      {props.children as never}
    </Show>
  )
}
