import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { SessionAuthenticationMethod } from "../../sessions/public/sessionAuthenticationMethodSchema.js"
import type { adminUserSecurityStateCreate } from "./adminUserSecurityStateCreate.js"
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

export function AdminUserSecurityView(props: { readonly state: ReturnType<typeof adminUserSecurityStateCreate> }) {
  return (
    <>
      <article class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h3 class="font-semibold">{messageTranslate("admin.users.sessions.title")}</h3>
        <p class="mt-2 text-sm text-muted-foreground">{messageTranslate("admin.users.sessions.description")}</p>
        <Show when={props.state.notice()}>
          {(notice) => (
            <p
              class="mt-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900"
              role="status"
            >
              {notice()}
            </p>
          )}
        </Show>
        <div class="mt-5">
          <SecurityStateBoundary
            detail={props.state.sessionsError()}
            emptyTitle={messageTranslate("admin.users.sessions.empty")}
            onRetry={props.state.sessionsReload}
            status={props.state.sessionsStatus()}
          >
            <div class="grid gap-3">
              <For each={props.state.sessions()}>
                {(session) => (
                  <article class="rounded-xl border border-line p-4" data-admin-user-session={session.id}>
                    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <h4 class="font-medium">
                            {session.device.description ?? messageTranslate("account.sessions.unknownDevice")}
                          </h4>
                          <Show when={session.current}>
                            <Badge variant="filledGreen">{messageTranslate("account.sessions.current")}</Badge>
                          </Show>
                        </div>
                        <dl class="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <MetadataItem
                            label={messageTranslate("admin.users.sessions.method")}
                            value={messageTranslate(authenticationMethodKeys[session.authenticationMethod])}
                          />
                          <MetadataItem
                            label={messageTranslate("admin.users.sessions.lastUsed")}
                            value={localeDateFormat(session.lastUsedAt, { dateStyle: "medium", timeStyle: "short" })}
                          />
                          <MetadataItem
                            label={messageTranslate("admin.users.sessions.created")}
                            value={localeDateFormat(session.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                          />
                          <MetadataItem
                            label={messageTranslate("admin.users.sessions.expires")}
                            value={localeDateFormat(session.expiresAt, { dateStyle: "medium", timeStyle: "short" })}
                          />
                          <Show when={session.device.ipAddress}>
                            {(ipAddress) => (
                              <MetadataItem
                                label={messageTranslate("admin.users.sessions.ipAddress")}
                                value={ipAddress()}
                              />
                            )}
                          </Show>
                        </dl>
                      </div>
                      <Button
                        disabled={props.state.pendingSessionId() !== undefined}
                        onClick={() => void props.state.sessionRevoke(session.id)}
                        variant="outline"
                      >
                        {messageTranslate("account.sessions.revoke")}
                      </Button>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </SecurityStateBoundary>
        </div>
      </article>

      <article class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h3 class="font-semibold">{messageTranslate("admin.users.authentication.title")}</h3>
        <p class="mt-2 text-sm text-muted-foreground">{messageTranslate("admin.users.authentication.description")}</p>
        <div class="mt-5">
          <SecurityStateBoundary
            detail={props.state.methodsError()}
            emptyTitle={messageTranslate("admin.users.authentication.empty")}
            onRetry={props.state.methodsReload}
            status={props.state.methodsStatus()}
          >
            <Show when={props.state.methods()}>
              {(methods) => (
                <div class="grid gap-4 sm:grid-cols-2">
                  <MethodCard
                    detail={
                      methods().emailOtp.available
                        ? messageTranslate("account.status.available")
                        : messageTranslate("account.status.notConfigured")
                    }
                    title={messageTranslate("account.factors.emailOtp")}
                  />
                  <MethodCard
                    detail={messageTranslate("account.factors.passkeyCount", {
                      count: methods().passkeys.credentials.length,
                    })}
                    title={messageTranslate("account.factors.passkeys")}
                  >
                    <For each={methods().passkeys.credentials}>
                      {(credential) => (
                        <p class="mt-2 text-xs text-muted-foreground">
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
                  </MethodCard>
                  <MethodCard
                    detail={
                      methods().recoveryCodes.available
                        ? messageTranslate("admin.users.authentication.recoveryCount", {
                            count: methods().recoveryCodes.remaining,
                          })
                        : messageTranslate("account.status.notConfigured")
                    }
                    title={messageTranslate("admin.users.authentication.recoveryCodes")}
                  >
                    <Show when={methods().recoveryCodes.generatedAt}>
                      {(generatedAt) => (
                        <p class="mt-2 text-xs text-muted-foreground">
                          {messageTranslate("admin.users.authentication.generated", {
                            date: localeDateFormat(generatedAt(), { dateStyle: "medium", timeStyle: "short" }),
                          })}
                        </p>
                      )}
                    </Show>
                  </MethodCard>
                  <MethodCard
                    detail={
                      methods().totp.enrolled
                        ? messageTranslate("account.status.configured")
                        : messageTranslate("account.status.notConfigured")
                    }
                    title={messageTranslate("account.factors.totp")}
                  >
                    <For each={methods().totp.enrollments}>
                      {(enrollment) => (
                        <p class="mt-2 text-xs text-muted-foreground">
                          {messageTranslate("admin.users.authentication.totpMetadata", {
                            confirmed:
                              enrollment.confirmedAt === null
                                ? messageTranslate("admin.users.authentication.pending")
                                : localeDateFormat(enrollment.confirmedAt, {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  }),
                            label: enrollment.label,
                          })}
                        </p>
                      )}
                    </For>
                  </MethodCard>
                </div>
              )}
            </Show>
          </SecurityStateBoundary>
        </div>
      </article>
    </>
  )
}

function MetadataItem(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd class="mt-0.5 break-all font-medium text-foreground">{props.value}</dd>
    </div>
  )
}

function MethodCard(props: { readonly children?: unknown; readonly detail: string; readonly title: string }) {
  return (
    <article class="rounded-xl border border-line p-4">
      <h4 class="font-medium">{props.title}</h4>
      <p class="mt-1 text-sm text-muted-foreground">{props.detail}</p>
      {props.children as never}
    </article>
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
          detail={props.detail}
          onRetry={props.status === "error" ? props.onRetry : undefined}
          state={
            props.status === "loading"
              ? "loading"
              : props.status === "empty"
                ? "empty"
                : props.status === "permission-denied" || props.status === "expired"
                  ? "inaccessible"
                  : "error"
          }
          title={props.status === "empty" ? props.emptyTitle : undefined}
        />
      }
    >
      {props.children as never}
    </Show>
  )
}
