import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AccountSplitColumns } from "./AccountSplitColumns.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountFactorsSection(props: { readonly state: AccountSecurityViewState }) {
  const totpEnrolled = () => props.state.methods().totp.enrolled
  const totpEnrollments = () => props.state.methods().totp.enrollments
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <p class="text-sm text-muted-foreground">{messageTranslate("account.factors.description")}</p>

      <AuthenticatedSection label={messageTranslate("shell.nav.mfa")} padded>
        <AuthenticatedFieldList
          columns={3}
          fields={[
            {
              label: messageTranslate("account.factors.emailOtp"),
              value: props.state.methods().emailOtp.available
                ? messageTranslate("account.status.available")
                : messageTranslate("account.status.unavailable"),
            },
            {
              label: messageTranslate("account.factors.passkeys"),
              value: messageTranslate("account.factors.passkeyCount", {
                count: props.state.methods().passkeys.credentials.length,
              }),
            },
            {
              label: messageTranslate("account.factors.recovery"),
              value: messageTranslate("account.factors.codeCount", {
                count: props.state.methods().recoveryCodes.remaining,
              }),
            },
          ]}
        />
      </AuthenticatedSection>

      {/* Enrolled authenticators stay on the left; enrolling another one is the right-hand card. */}
      <AccountSplitColumns
        secondary={
          <>
            <AuthenticatedSection padded title={messageTranslate("account.factors.addTotp")}>
              <Button
                disabled={props.state.pendingId()?.startsWith("totp:")}
                onClick={props.state.totpStart}
                size="sm"
                variant="filledBlue"
              >
                {messageTranslate("account.factors.addTotp")}
              </Button>
            </AuthenticatedSection>

            <Show when={props.state.totpSetup()}>
              {(setup) => (
                <AuthenticatedSection
                  class="border-accent/35"
                  description={messageTranslate("account.factors.totpSecretOnce")}
                  title={messageTranslate("account.factors.finishTotp")}
                >
                  <div class="grid min-w-0 gap-2.5 px-3 py-3">
                    {/* The shared secret is displayed once, so it stays selectable rather than truncated. */}
                    <code class="block overflow-x-auto rounded-control border border-line-subtle bg-muted px-2 py-1.5 font-mono text-xs tracking-wider">
                      {setup().secret}
                    </code>
                    <p class="break-all font-mono text-xs text-muted-foreground">{setup().otpauthUri}</p>
                    <div class="grid items-end gap-2 sm:grid-cols-[minmax(0,16rem)_auto_auto]">
                      <div class="grid min-w-0 gap-1">
                        <Label for="account-totp-code">{messageTranslate("account.factors.verificationCode")}</Label>
                        <Input
                          autocomplete="one-time-code"
                          class="font-mono"
                          id="account-totp-code"
                          inputmode="numeric"
                          maxlength={6}
                          onInput={props.state.codeInput}
                          value={props.state.code()}
                        />
                      </div>
                      <Button
                        disabled={!/^\d{6}$/.test(props.state.code())}
                        onClick={props.state.totpConfirm}
                        size="sm"
                      >
                        {messageTranslate("account.factors.confirm")}
                      </Button>
                      <Button onClick={props.state.totpSetupDismiss} size="sm" variant="ghost">
                        {messageTranslate("common.cancel")}
                      </Button>
                    </div>
                  </div>
                </AuthenticatedSection>
              )}
            </Show>
          </>
        }
        primary={
          <AuthenticatedSection
            actions={
              <AuthenticatedStatus
                label={
                  totpEnrolled()
                    ? messageTranslate("account.status.configured")
                    : messageTranslate("account.status.notConfigured")
                }
                tone={totpEnrolled() ? "success" : "neutral"}
              />
            }
            title={messageTranslate("account.factors.totp")}
          >
            {/* Every active enrollment is an independent authenticator with its own removal control. */}
            <Show
              when={totpEnrollments().length > 0}
              fallback={
                <ProductionStatePanel compact state="empty" title={messageTranslate("account.status.notConfigured")} />
              }
            >
              <ul class="divide-y divide-line-subtle">
                <For each={totpEnrollments()}>
                  {(enrollment) => (
                    <li class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2.5">
                      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <span class="min-w-0 truncate text-sm font-medium">{enrollment.label}</span>
                        <AuthenticatedStatus
                          label={
                            enrollment.status === "active"
                              ? messageTranslate("account.status.configured")
                              : messageTranslate("account.profile.verificationPending")
                          }
                          tone={enrollment.status === "active" ? "success" : "neutral"}
                        />
                      </div>
                      {/* Removal only applies to active enrollments; the server rejects removing a pending one. */}
                      <Show when={enrollment.status === "active"}>
                        <Button
                          disabled={props.state.pendingId()?.startsWith("totp:")}
                          onClick={() => props.state.totpRemove(enrollment.id)}
                          size="sm"
                          variant="filledRed"
                        >
                          {messageTranslate("account.factors.removeTotp")}
                        </Button>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </AuthenticatedSection>
        }
      />
    </div>
  )
}
