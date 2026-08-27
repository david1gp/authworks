import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiCellphone } from "@adaptive-ds/mdi/mdiCellphone.js"
import { mdiCellphoneKey } from "@adaptive-ds/mdi/mdiCellphoneKey.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiClipboardTextOutline } from "@adaptive-ds/mdi/mdiClipboardTextOutline.js"
import { mdiClockOutline } from "@adaptive-ds/mdi/mdiClockOutline.js"
import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiFingerprint } from "@adaptive-ds/mdi/mdiFingerprint.js"
import { mdiGithub } from "@adaptive-ds/mdi/mdiGithub.js"
import { mdiGoogle } from "@adaptive-ds/mdi/mdiGoogle.js"
import { mdiKeyOutline } from "@adaptive-ds/mdi/mdiKeyOutline.js"
import { mdiLaptop } from "@adaptive-ds/mdi/mdiLaptop.js"
import { mdiLifebuoy } from "@adaptive-ds/mdi/mdiLifebuoy.js"
import { mdiLinkVariant } from "@adaptive-ds/mdi/mdiLinkVariant.js"
import { mdiLockOutline } from "@adaptive-ds/mdi/mdiLockOutline.js"
import { mdiMicrosoft } from "@adaptive-ds/mdi/mdiMicrosoft.js"
import { mdiMonitorCellphone } from "@adaptive-ds/mdi/mdiMonitorCellphone.js"
import { mdiOpenid } from "@adaptive-ds/mdi/mdiOpenid.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { mdiShieldCheckOutline } from "@adaptive-ds/mdi/mdiShieldCheckOutline.js"
import { mdiShieldKeyOutline } from "@adaptive-ds/mdi/mdiShieldKeyOutline.js"
import { mdiTrashCanOutline } from "@adaptive-ds/mdi/mdiTrashCanOutline.js"
import { For, Match, Show, Switch } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import type { AccountSecurityHistoryItem } from "../public/accountSecurityHistoryItemSchema.js"
import type { accountSecurityDemoStateCreate } from "./accountSecurityDemoStateCreate.js"
import type { accountSecurityProductionStateCreate } from "./accountSecurityProductionStateCreate.js"

const securityHistoryCategoryMessageKeyByCategory = {
  email_changes: "account.securityHistory.category.emailChanges",
  impersonation: "account.securityHistory.category.impersonation",
  linked_identities: "account.securityHistory.category.linkedIdentities",
  mfa: "account.securityHistory.category.mfa",
  passwords: "account.securityHistory.category.passwords",
  passkeys: "account.securityHistory.category.passkeys",
  refresh_tokens: "account.securityHistory.category.refreshTokens",
  sessions: "account.securityHistory.category.sessions",
} as const satisfies Readonly<Record<AccountSecurityHistoryItem["category"], MessageKey>>

const securityHistoryDisplayMessageKeyByCode = {
  "email_change.changed": "account.securityHistory.event.emailChanged",
  "email_change.failed": "account.securityHistory.event.emailChangeFailed",
  "email_change.requested": "account.securityHistory.event.emailChangeRequested",
  "email_change.verified": "account.securityHistory.event.emailChangeVerified",
  "impersonation.ended": "account.securityHistory.event.impersonationEnded",
  "impersonation.started": "account.securityHistory.event.impersonationStarted",
  "linked_identity.linked": "account.securityHistory.event.identityLinked",
  "linked_identity.unlinked": "account.securityHistory.event.identityUnlinked",
  "mfa.challenge.completed": "account.securityHistory.event.mfaCompleted",
  "mfa.challenge.failed": "account.securityHistory.event.mfaFailed",
  "mfa.challenge.started": "account.securityHistory.event.mfaStarted",
  "mfa.recovery_code.used": "account.securityHistory.event.recoveryCodeUsed",
  "mfa.recovery_codes.generated": "account.securityHistory.event.recoveryCodesGenerated",
  "mfa.totp.enrollment.confirmed": "account.securityHistory.event.totpEnrollmentConfirmed",
  "mfa.totp.enrollment.started": "account.securityHistory.event.totpEnrollmentStarted",
  "mfa.totp.removed": "account.securityHistory.event.totpRemoved",
  "mfa.totp.verified": "account.securityHistory.event.totpVerified",
  "passkey.authentication_completed": "account.securityHistory.event.passkeyAuthenticationCompleted",
  "passkey.authentication_started": "account.securityHistory.event.passkeyAuthenticationStarted",
  "passkey.credential_revoked": "account.securityHistory.event.passkeyCredentialRevoked",
  "passkey.credential_used": "account.securityHistory.event.passkeyCredentialUsed",
  "passkey.registration_completed": "account.securityHistory.event.passkeyRegistrationCompleted",
  "passkey.registration_started": "account.securityHistory.event.passkeyRegistrationStarted",
  "password.credential_changed": "account.securityHistory.event.passwordChanged",
  "password.email_verified": "account.securityHistory.event.passwordEmailVerified",
  "password.locked": "account.securityHistory.event.passwordLocked",
  "password.login_failed": "account.securityHistory.event.passwordLoginFailed",
  "password.login_succeeded": "account.securityHistory.event.passwordLoginSucceeded",
  "password.recovered": "account.securityHistory.event.passwordRecovered",
  "password.recovery_requested": "account.securityHistory.event.passwordRecoveryRequested",
  "password.unlocked": "account.securityHistory.event.passwordUnlocked",
  "password.whatsapp_verified": "account.securityHistory.event.passwordWhatsappVerified",
  "refresh_token.access_revoked": "account.securityHistory.event.accessTokenRevoked",
  "refresh_token.family_revoked": "account.securityHistory.event.refreshTokenFamilyRevoked",
  "session.created": "account.securityHistory.event.sessionCreated",
  "session.revoked": "account.securityHistory.event.sessionRevoked",
  "session.revoked_all": "account.securityHistory.event.sessionsRevoked",
  "session.rotated": "account.securityHistory.event.sessionRotated",
} as const satisfies Readonly<Record<AccountSecurityHistoryItem["displayCode"], MessageKey>>

type AccountSecurityViewState =
  | ReturnType<typeof accountSecurityProductionStateCreate>
  | ReturnType<typeof accountSecurityDemoStateCreate>

export function AccountSecurityView(props: { readonly state: AccountSecurityViewState }) {
  return (
    <section aria-label={messageTranslate("account.security.label")} class="grid max-w-4xl gap-6 sm:gap-8">
      <Show when={props.state.error()}>
        {(error) => (
          <div
            class="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
            role="alert"
          >
            <Icon class="size-4 shrink-0" path={mdiAlertCircleOutline} />
            <span>{error()}</span>
          </div>
        )}
      </Show>
      <Switch>
        <Match when={props.state.status() === "loading"}>
          <div class="grid min-h-56 place-items-center rounded-2xl border border-line bg-surface p-8" role="status">
            <div class="text-center">
              <LoaderShuffle4Dots />
              <p class="mt-4 text-sm font-medium text-muted-foreground">{messageTranslate("common.loading")}</p>
            </div>
          </div>
        </Match>
        <Match when={props.state.status() === "error"}>
          <div class="rounded-2xl border border-line bg-surface p-8 text-center shadow-xs">
            <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
              <Icon class="size-6" path={mdiAlertCircleOutline} />
            </div>
            <h2 class="mt-4 text-xl font-semibold tracking-tight">{messageTranslate("common.error")}</h2>
            <Button class="mt-5" onClick={props.state.reload} variant="outline">
              {messageTranslate("common.retry")}
            </Button>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "sessions"}>
          <div class="grid gap-6">
            <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {messageTranslate("account.sessions.description")}
            </p>
            <Show
              when={props.state.sessions().length > 0}
              fallback={<EmptyState title={messageTranslate("account.sessions.empty")} />}
            >
              <div class="grid gap-4">
                <For each={props.state.sessions()}>
                  {(session) => (
                    <article
                      class={`rounded-2xl border bg-surface p-6 shadow-xs transition-colors ${
                        session.current
                          ? "border-accent ring-1 ring-accent/30"
                          : "border-line hover:border-line-strong/60"
                      }`}
                    >
                      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div class="flex items-start gap-3.5 min-w-0">
                          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <Icon
                              class="size-5"
                              path={
                                session.device.description?.toLowerCase().includes("iphone") ||
                                session.device.description?.toLowerCase().includes("android") ||
                                session.device.description?.toLowerCase().includes("phone")
                                  ? mdiCellphone
                                  : mdiLaptop
                              }
                            />
                          </div>
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                              <h2 class="font-semibold text-foreground">
                                {session.device.description ?? messageTranslate("account.sessions.unknownDevice")}
                              </h2>
                              <Show when={session.current}>
                                <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <Icon class="size-3" path={mdiCheckCircleOutline} />
                                  {messageTranslate("account.sessions.current")}
                                </span>
                              </Show>
                            </div>
                            <p class="mt-1.5 text-xs font-medium text-muted-foreground">
                              {session.authenticationMethod} · {session.assurance}
                            </p>
                            <p class="mt-1 text-xs text-muted-foreground">
                              {messageTranslate("account.sessions.lastUsed", {
                                date: localeDateFormat(session.lastUsedAt, { dateStyle: "medium", timeStyle: "short" }),
                              })}
                            </p>
                            <Show when={session.device.ipAddress}>
                              <p class="mt-1 font-mono text-xs text-muted-foreground">{session.device.ipAddress}</p>
                            </Show>
                          </div>
                        </div>
                        <Show when={!session.current}>
                          <Button
                            disabled={props.state.pendingId() === `session:${session.id}`}
                            onClick={() => props.state.sessionRevoke(session.id)}
                            variant="outlineRed"
                          >
                            <Icon class="mr-1.5 size-4" path={mdiTrashCanOutline} />
                            {messageTranslate("account.sessions.revoke")}
                          </Button>
                        </Show>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "passkeys"}>
          <div class="grid gap-6">
            <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {messageTranslate("account.passkeys.description")}
              </p>
              <Button
                disabled={props.state.pendingId() === "passkey:add"}
                onClick={props.state.passkeyAdd}
                variant="filledBlue"
              >
                <Icon class="mr-1.5 size-4" path={mdiPlus} />
                {messageTranslate("account.passkeys.add")}
              </Button>
            </div>
            <Show
              when={props.state.passkeys().length > 0}
              fallback={<EmptyState title={messageTranslate("account.passkeys.empty")} />}
            >
              <div class="grid gap-4">
                <For each={props.state.passkeys()}>
                  {(credential) => (
                    <article class="rounded-2xl border border-line bg-surface p-6 shadow-xs transition-colors hover:border-line-strong/60">
                      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div class="flex items-start gap-3.5 min-w-0">
                          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <Icon class="size-5" path={mdiFingerprint} />
                          </div>
                          <div>
                            <div class="flex flex-wrap items-center gap-2">
                              <h2 class="font-semibold text-foreground">
                                {credential.backedUp
                                  ? messageTranslate("account.passkeys.synced")
                                  : messageTranslate("account.passkeys.deviceBound")}
                              </h2>
                              <span class="inline-flex items-center rounded-full border border-line bg-muted/60 px-2.5 py-0.5 text-xs font-medium">
                                {credential.backedUp
                                  ? messageTranslate("account.passkeys.synced")
                                  : messageTranslate("account.passkeys.deviceBound")}
                              </span>
                            </div>
                            <p class="mt-1.5 text-xs text-muted-foreground">
                              {messageTranslate("account.passkeys.created", {
                                date: localeDateFormat(credential.createdAt, { dateStyle: "medium" }),
                              })}
                            </p>
                            <div class="mt-2 flex flex-wrap gap-1.5">
                              <For each={credential.transports}>
                                {(transport) => (
                                  <span class="rounded-md border border-line bg-muted/40 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                                    {transport}
                                  </span>
                                )}
                              </For>
                            </div>
                          </div>
                        </div>
                        <Button
                          disabled={props.state.pendingId() === `passkey:${credential.id}`}
                          onClick={() => props.state.passkeyRevoke(credential.id)}
                          variant="outlineRed"
                        >
                          <Icon class="mr-1.5 size-4" path={mdiTrashCanOutline} />
                          {messageTranslate("account.passkeys.remove")}
                        </Button>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "factors"}>
          <div class="grid gap-6">
            <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {messageTranslate("account.factors.description")}
            </p>
            <div class="grid gap-4 sm:grid-cols-3">
              <SummaryCard
                icon={mdiEmailOutline}
                title={messageTranslate("account.factors.emailOtp")}
                value={
                  props.state.methods().emailOtp.available
                    ? messageTranslate("account.status.available")
                    : messageTranslate("account.status.unavailable")
                }
              />
              <SummaryCard
                icon={mdiFingerprint}
                title={messageTranslate("account.factors.passkeys")}
                value={messageTranslate("account.factors.passkeyCount", {
                  count: props.state.methods().passkeys.credentials.length,
                })}
              />
              <SummaryCard
                icon={mdiLifebuoy}
                title={messageTranslate("account.factors.recovery")}
                value={messageTranslate("account.factors.codeCount", {
                  count: props.state.methods().recoveryCodes.remaining,
                })}
              />
            </div>
            <article class="rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div class="flex items-center gap-3.5">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon class="size-5" path={mdiCellphoneKey} />
                  </div>
                  <div>
                    <h2 class="font-semibold text-foreground">{messageTranslate("account.factors.totp")}</h2>
                    <p class="mt-0.5 text-sm text-muted-foreground">
                      {props.state.methods().totp.enrolled
                        ? messageTranslate("account.status.configured")
                        : messageTranslate("account.status.notConfigured")}
                    </p>
                  </div>
                </div>
                <Button
                  disabled={props.state.pendingId()?.startsWith("totp:")}
                  onClick={props.state.methods().totp.enrolled ? props.state.totpRemove : props.state.totpStart}
                  variant={props.state.methods().totp.enrolled ? "outlineRed" : "filledBlue"}
                >
                  {props.state.methods().totp.enrolled
                    ? messageTranslate("account.factors.removeTotp")
                    : messageTranslate("account.factors.addTotp")}
                </Button>
              </div>
            </article>
            <Show when={props.state.totpSetup()}>
              {(setup) => (
                <article class="rounded-2xl border border-accent/40 bg-accent/5 p-6 shadow-xs sm:p-8">
                  <div class="flex items-center gap-2">
                    <Icon class="size-5 text-accent" path={mdiShieldCheckOutline} />
                    <h2 class="text-lg font-semibold tracking-tight">
                      {messageTranslate("account.factors.finishTotp")}
                    </h2>
                  </div>
                  <p class="mt-1.5 text-sm text-muted-foreground">
                    {messageTranslate("account.factors.totpSecretOnce")}
                  </p>
                  <code class="mt-4 block overflow-x-auto rounded-xl border border-line bg-surface p-3.5 font-mono text-sm tracking-wider">
                    {setup().secret}
                  </code>
                  <p class="mt-3 break-all text-xs text-muted-foreground">{setup().otpauthUri}</p>
                  <div class="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Input
                      aria-label={messageTranslate("account.factors.verificationCode")}
                      autocomplete="one-time-code"
                      class="rounded-xl border border-line bg-background px-3.5 py-2.5 font-mono text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                      inputmode="numeric"
                      maxlength={6}
                      onInput={props.state.codeInput}
                      value={props.state.code()}
                    />
                    <Button
                      disabled={!/^\d{6}$/.test(props.state.code())}
                      onClick={props.state.totpConfirm}
                      variant="filledBlue"
                    >
                      {messageTranslate("account.factors.confirm")}
                    </Button>
                    <Button onClick={props.state.totpSetupDismiss} variant="ghost">
                      {messageTranslate("common.cancel")}
                    </Button>
                  </div>
                </article>
              )}
            </Show>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "recovery-codes"}>
          <div class="grid gap-6">
            <article class="rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
              <div class="flex items-center gap-2">
                <Icon class="size-5 text-accent" path={mdiLifebuoy} />
                <h2 class="text-xl font-semibold tracking-tight">{messageTranslate("account.recovery.summary")}</h2>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
                {messageTranslate("account.recovery.remaining", {
                  count: props.state.methods().recoveryCodes.remaining,
                })}
              </p>
              <Button
                class="mt-5"
                disabled={props.state.pendingId() === "recovery:generate"}
                onClick={props.state.recoveryCodesGenerate}
                variant="filledBlue"
              >
                {messageTranslate("account.recovery.generate")}
              </Button>
            </article>
            <Show when={props.state.oneTimeCodes().length > 0}>
              <article
                class="rounded-2xl border border-accent/40 bg-accent/5 p-6 shadow-xs sm:p-8"
                data-one-time-secret="recovery-codes"
              >
                <div class="flex items-center gap-2">
                  <Icon class="size-5 text-accent" path={mdiShieldCheckOutline} />
                  <h3 class="text-lg font-semibold tracking-tight">{messageTranslate("account.recovery.saveNow")}</h3>
                </div>
                <p class="mt-1.5 text-sm text-muted-foreground">{messageTranslate("account.recovery.once")}</p>
                <ul class="mt-4 grid gap-2.5 rounded-xl border border-line bg-surface p-4 font-mono text-sm sm:grid-cols-2">
                  <For each={props.state.oneTimeCodes()}>
                    {(code) => (
                      <li class="rounded-lg bg-muted/60 p-2.5 text-center font-semibold tracking-widest text-foreground">
                        {code}
                      </li>
                    )}
                  </For>
                </ul>
                <Button class="mt-5" onClick={props.state.oneTimeCodesDismiss} variant="outline">
                  {messageTranslate("account.recovery.saved")}
                </Button>
              </article>
            </Show>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "identities"}>
          <div class="grid gap-6">
            <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {messageTranslate("account.identities.description")}
            </p>
            <article class="rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
              <h2 class="text-lg font-semibold tracking-tight">{messageTranslate("account.identities.linkTitle")}</h2>
              <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("account.identities.linkDescription")}</p>
              <div class="mt-5 flex flex-wrap gap-3">
                <For each={props.state.identityProviders()}>
                  {(provider) => (
                    <Button
                      disabled={
                        props.state.identityProviderLinked(provider.id) || props.state.pendingId() !== undefined
                      }
                      onClick={() => props.state.identityLinkStart(provider.id)}
                      variant="outline"
                    >
                      <Icon
                        class="mr-1.5 size-4"
                        path={
                          provider.type === "google"
                            ? mdiGoogle
                            : provider.type === "github"
                              ? mdiGithub
                              : provider.type === "microsoft"
                                ? mdiMicrosoft
                                : mdiLinkVariant
                        }
                      />
                      {provider.displayName}
                    </Button>
                  )}
                </For>
              </div>
            </article>
            <Show when={props.state.identityLinkConfirmation()}>
              <article class="rounded-2xl border border-accent/40 bg-accent/5 p-6 shadow-xs sm:p-8">
                <div class="flex items-center gap-2">
                  <Icon class="size-5 text-accent" path={mdiShieldCheckOutline} />
                  <h2 class="text-lg font-semibold tracking-tight">
                    {messageTranslate("account.identities.confirmTitle")}
                  </h2>
                </div>
                <p class="mt-1.5 text-sm text-muted-foreground">
                  {messageTranslate("account.identities.confirmDescription", {
                    provider:
                      props.state.identityLinkProvider() ?? messageTranslate("account.identities.externalAccount"),
                  })}
                </p>
                <div class="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button
                    disabled={props.state.pendingId() === "identity:link:confirm"}
                    onClick={props.state.identityLinkConfirm}
                    variant="filledBlue"
                  >
                    {messageTranslate("account.identities.confirm")}
                  </Button>
                  <Button onClick={props.state.identityLinkCancel} variant="ghost">
                    {messageTranslate("common.cancel")}
                  </Button>
                </div>
              </article>
            </Show>
            <Show
              when={props.state.identities().length > 0}
              fallback={<EmptyState title={messageTranslate("account.identities.empty")} />}
            >
              <div class="grid gap-4">
                <For each={props.state.identities()}>
                  {(identity) => (
                    <article class="rounded-2xl border border-line bg-surface p-6 shadow-xs transition-colors hover:border-line-strong/60">
                      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div class="flex items-center gap-3.5 min-w-0">
                          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <Icon
                              class="size-5"
                              path={
                                identity.providerType === "google"
                                  ? mdiGoogle
                                  : identity.providerType === "github"
                                    ? mdiGithub
                                    : identity.providerType === "microsoft"
                                      ? mdiMicrosoft
                                      : mdiLinkVariant
                              }
                            />
                          </div>
                          <div class="min-w-0">
                            <h2 class="font-semibold capitalize text-foreground">{identity.providerType}</h2>
                            <p class="truncate text-sm text-muted-foreground">
                              {identity.email ?? identity.username ?? identity.displayName ?? identity.externalSubject}
                            </p>
                          </div>
                        </div>
                        <Button
                          disabled={props.state.pendingId() === `identity:${identity.providerId}`}
                          onClick={() => props.state.identityUnlink(identity.providerId, identity.externalSubject)}
                          variant="outlineRed"
                        >
                          <Icon class="mr-1.5 size-4" path={mdiTrashCanOutline} />
                          {messageTranslate("account.identities.unlink")}
                        </Button>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "refresh-tokens"}>
          <div class="grid gap-6">
            <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div class="flex items-center gap-2">
                  <Icon class="size-5 text-accent" path={mdiOpenid} />
                  <h2 class="text-xl font-semibold tracking-tight">{messageTranslate("shell.nav.refreshTokens")}</h2>
                </div>
                <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {messageTranslate("account.refreshTokens.description")}
                </p>
              </div>
              <Show when={props.state.refreshTokens().some((token) => token.status === "active")}>
                <Button
                  disabled={props.state.pendingId() === "refresh-tokens:all"}
                  onClick={props.state.refreshTokensRevokeAll}
                  variant="outlineRed"
                >
                  <Icon class="mr-1.5 size-4" path={mdiTrashCanOutline} />
                  {messageTranslate("account.refreshTokens.revokeAll")}
                </Button>
              </Show>
            </div>
            <Show
              when={props.state.refreshTokens().length > 0}
              fallback={<EmptyState title={messageTranslate("account.refreshTokens.empty")} />}
            >
              <div class="grid gap-4">
                <For each={props.state.refreshTokens()}>
                  {(token) => (
                    <article class="rounded-2xl border border-line bg-surface p-6 shadow-xs transition-colors hover:border-line-strong/60">
                      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div class="flex items-start gap-3.5 min-w-0">
                          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <Icon class="size-5" path={mdiKeyOutline} />
                          </div>
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                              <h2 class="font-semibold text-foreground">{token.clientName}</h2>
                              <span
                                class={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                                  token.status === "active"
                                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : token.status === "expired"
                                      ? "border border-line bg-muted text-muted-foreground"
                                      : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300"
                                }`}
                              >
                                {token.status === "active"
                                  ? messageTranslate("account.refreshTokens.active")
                                  : token.status === "expired"
                                    ? messageTranslate("account.refreshTokens.expired")
                                    : messageTranslate("account.refreshTokens.revoked")}
                              </span>
                            </div>
                            <p class="mt-1.5 text-xs text-muted-foreground">
                              {messageTranslate("account.refreshTokens.scope", { scope: token.scope.join(" · ") })}
                            </p>
                            <Show
                              when={token.lastUsedAt !== null}
                              fallback={
                                <p class="mt-1 text-xs text-muted-foreground">
                                  {messageTranslate("account.refreshTokens.neverUsed")}
                                </p>
                              }
                            >
                              <p class="mt-1 text-xs text-muted-foreground">
                                {messageTranslate("account.refreshTokens.lastUsed", {
                                  date: localeDateFormat(token.lastUsedAt as number, {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  }),
                                })}
                              </p>
                            </Show>
                            <p class="mt-0.5 text-xs text-muted-foreground">
                              {messageTranslate("account.refreshTokens.expires", {
                                date: localeDateFormat(token.expiresAt, { dateStyle: "medium", timeStyle: "short" }),
                              })}
                            </p>
                            <Show when={token.revokedAt !== null}>
                              <p class="mt-0.5 text-xs text-muted-foreground">
                                {messageTranslate("account.refreshTokens.revokedAt", {
                                  date: localeDateFormat(token.revokedAt as number, {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  }),
                                })}
                              </p>
                            </Show>
                          </div>
                        </div>
                        <Show when={token.status === "active"}>
                          <Button
                            disabled={props.state.pendingId() === `refresh-token:${token.familyId}`}
                            onClick={() => props.state.refreshTokenRevoke(token.familyId)}
                            variant="outlineRed"
                          >
                            <Icon class="mr-1.5 size-4" path={mdiTrashCanOutline} />
                            {messageTranslate("account.refreshTokens.revoke")}
                          </Button>
                        </Show>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "security-history"}>
          <div class="grid gap-6">
            <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {messageTranslate("account.securityHistory.description")}
            </p>
            <Show
              when={props.state.securityHistory().length > 0}
              fallback={<EmptyState title={messageTranslate("account.securityHistory.empty")} />}
            >
              <div class="grid gap-3" data-security-history-list>
                <For each={props.state.securityHistory()}>
                  {(item) => (
                    <article
                      class="rounded-2xl border border-line bg-surface p-5 shadow-xs transition-colors hover:border-line-strong/60"
                      data-security-history-item
                    >
                      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div class="flex items-center gap-3.5 min-w-0">
                          <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <Icon class="size-4.5" path={mdiClockOutline} />
                          </div>
                          <div>
                            <span class="inline-flex rounded-full border border-line bg-muted/60 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                              {messageTranslate(securityHistoryCategoryMessageKeyByCategory[item.category])}
                            </span>
                            <h2 class="mt-1 text-sm font-semibold text-foreground">
                              {messageTranslate(securityHistoryDisplayMessageKeyByCode[item.displayCode])}
                            </h2>
                          </div>
                        </div>
                        <time
                          class="shrink-0 text-xs font-medium text-muted-foreground"
                          dateTime={new Date(item.occurredAt).toISOString()}
                        >
                          {localeDateFormat(item.occurredAt, { dateStyle: "medium", timeStyle: "short" })}
                        </time>
                      </div>
                    </article>
                  )}
                </For>
              </div>
              <Show when={props.state.securityHistoryNextPageToken()}>
                <div class="flex justify-center pt-2">
                  <Button
                    disabled={props.state.pendingId() === "security-history:next"}
                    onClick={props.state.securityHistoryLoadMore}
                    variant="outline"
                  >
                    {messageTranslate("account.securityHistory.loadMore")}
                  </Button>
                </div>
              </Show>
            </Show>
          </div>
        </Match>
      </Switch>
    </section>
  )
}

function EmptyState(props: { readonly title: string }) {
  return (
    <div class="rounded-2xl border border-dashed border-line-strong/70 bg-muted/30 p-10 text-center">
      <h3 class="font-semibold text-muted-foreground">{props.title}</h3>
    </div>
  )
}

function SummaryCard(props: { readonly icon: string; readonly title: string; readonly value: string }) {
  return (
    <article class="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xs">
      <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent dark:bg-accent/20">
        <Icon class="size-5.5" path={props.icon} />
      </div>
      <div class="min-w-0">
        <h3 class="truncate text-xs font-medium text-muted-foreground">{props.title}</h3>
        <p class="mt-0.5 truncate text-lg font-bold tracking-tight text-foreground">{props.value}</p>
      </div>
    </article>
  )
}
