import { For, Match, Show, Switch } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { LoaderShuffle4Dots } from "#ui/static/loaders/LoaderShuffle4Dots.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { accountSecurityDemoStateCreate } from "./accountSecurityDemoStateCreate.js"
import type { accountSecurityProductionStateCreate } from "./accountSecurityProductionStateCreate.js"

type AccountSecurityViewState =
  | ReturnType<typeof accountSecurityProductionStateCreate>
  | ReturnType<typeof accountSecurityDemoStateCreate>

export function AccountSecurityView(props: { readonly state: AccountSecurityViewState }) {
  return (
    <section aria-label={messageTranslate("account.security.label")} class="grid gap-5">
      <Show when={props.state.error()}>
        {(error) => (
          <div class="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger" role="alert">
            {error()}
          </div>
        )}
      </Show>
      <Switch>
        <Match when={props.state.status() === "loading"}>
          <div class="grid min-h-56 place-items-center rounded-2xl border border-line bg-surface" role="status">
            <div class="text-center">
              <LoaderShuffle4Dots />
              <p class="mt-4 text-sm font-medium">{messageTranslate("common.loading")}</p>
            </div>
          </div>
        </Match>
        <Match when={props.state.status() === "error"}>
          <div class="rounded-2xl border border-line bg-surface p-8 text-center">
            <h2 class="text-xl font-semibold">{messageTranslate("common.error")}</h2>
            <Button class="mt-5" onClick={props.state.reload}>
              {messageTranslate("common.retry")}
            </Button>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "sessions"}>
          <div class="grid gap-4">
            <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
              {messageTranslate("account.sessions.description")}
            </p>
            <Show
              when={props.state.sessions().length > 0}
              fallback={<EmptyState title={messageTranslate("account.sessions.empty")} />}
            >
              <For each={props.state.sessions()}>
                {(session) => (
                  <article class="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <div class="flex flex-wrap items-center gap-2">
                          <h2 class="font-semibold">
                            {session.device.description ?? messageTranslate("account.sessions.unknownDevice")}
                          </h2>
                          <Show when={session.current}>
                            <span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-950 dark:text-green-200">
                              {messageTranslate("account.sessions.current")}
                            </span>
                          </Show>
                        </div>
                        <p class="mt-2 text-sm text-muted-foreground">
                          {session.authenticationMethod} · {session.assurance}
                        </p>
                        <p class="mt-1 text-sm text-muted-foreground">
                          {messageTranslate("account.sessions.lastUsed", {
                            date: localeDateFormat(session.lastUsedAt, { dateStyle: "medium", timeStyle: "short" }),
                          })}
                        </p>
                        <Show when={session.device.ipAddress}>
                          <p class="mt-1 font-mono text-xs text-muted-foreground">{session.device.ipAddress}</p>
                        </Show>
                      </div>
                      <Show when={!session.current}>
                        <Button
                          disabled={props.state.pendingId() === `session:${session.id}`}
                          onClick={() => props.state.sessionRevoke(session.id)}
                          variant="outline"
                        >
                          {messageTranslate("account.sessions.revoke")}
                        </Button>
                      </Show>
                    </div>
                  </article>
                )}
              </For>
            </Show>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "passkeys"}>
          <div class="grid gap-5">
            <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
                {messageTranslate("account.passkeys.description")}
              </p>
              <Button disabled={props.state.pendingId() === "passkey:add"} onClick={props.state.passkeyAdd}>
                {messageTranslate("account.passkeys.add")}
              </Button>
            </div>
            <Show
              when={props.state.passkeys().length > 0}
              fallback={<EmptyState title={messageTranslate("account.passkeys.empty")} />}
            >
              <For each={props.state.passkeys()}>
                {(credential) => (
                  <article class="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <h2 class="font-semibold">
                          {credential.backedUp
                            ? messageTranslate("account.passkeys.synced")
                            : messageTranslate("account.passkeys.deviceBound")}
                        </h2>
                        <p class="mt-2 text-sm text-muted-foreground">
                          {messageTranslate("account.passkeys.created", {
                            date: localeDateFormat(credential.createdAt, { dateStyle: "medium" }),
                          })}
                        </p>
                        <p class="mt-1 text-xs text-muted-foreground">{credential.transports.join(" · ")}</p>
                      </div>
                      <Button
                        disabled={props.state.pendingId() === `passkey:${credential.id}`}
                        onClick={() => props.state.passkeyRevoke(credential.id)}
                        variant="outline"
                      >
                        {messageTranslate("account.passkeys.remove")}
                      </Button>
                    </div>
                  </article>
                )}
              </For>
            </Show>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "factors"}>
          <div class="grid gap-5">
            <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
              {messageTranslate("account.factors.description")}
            </p>
            <div class="grid gap-4 md:grid-cols-3">
              <SummaryCard
                title={messageTranslate("account.factors.emailOtp")}
                value={
                  props.state.methods().emailOtp.available
                    ? messageTranslate("account.status.available")
                    : messageTranslate("account.status.unavailable")
                }
              />
              <SummaryCard
                title={messageTranslate("account.factors.passkeys")}
                value={messageTranslate("account.factors.passkeyCount", {
                  count: props.state.methods().passkeys.credentials.length,
                })}
              />
              <SummaryCard
                title={messageTranslate("account.factors.recovery")}
                value={messageTranslate("account.factors.codeCount", {
                  count: props.state.methods().recoveryCodes.remaining,
                })}
              />
            </div>
            <article class="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 class="font-semibold">{messageTranslate("account.factors.totp")}</h2>
                  <p class="mt-1 text-sm text-muted-foreground">
                    {props.state.methods().totp.enrolled
                      ? messageTranslate("account.status.configured")
                      : messageTranslate("account.status.notConfigured")}
                  </p>
                </div>
                <Button
                  disabled={props.state.pendingId()?.startsWith("totp:")}
                  onClick={props.state.methods().totp.enrolled ? props.state.totpRemove : props.state.totpStart}
                  variant={props.state.methods().totp.enrolled ? "outline" : "filled"}
                >
                  {props.state.methods().totp.enrolled
                    ? messageTranslate("account.factors.removeTotp")
                    : messageTranslate("account.factors.addTotp")}
                </Button>
              </div>
            </article>
            <Show when={props.state.totpSetup()}>
              {(setup) => (
                <article class="rounded-2xl border border-accent/40 bg-surface p-5 shadow-sm">
                  <h2 class="font-semibold">{messageTranslate("account.factors.finishTotp")}</h2>
                  <p class="mt-2 text-sm text-muted-foreground">{messageTranslate("account.factors.totpSecretOnce")}</p>
                  <code class="mt-4 block overflow-x-auto rounded-lg bg-muted p-3 text-sm">{setup().secret}</code>
                  <p class="mt-3 break-all text-xs text-muted-foreground">{setup().otpauthUri}</p>
                  <div class="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Input
                      aria-label={messageTranslate("account.factors.verificationCode")}
                      autocomplete="one-time-code"
                      inputmode="numeric"
                      maxlength={6}
                      onInput={props.state.codeInput}
                      value={props.state.code()}
                    />
                    <Button disabled={!/^\d{6}$/.test(props.state.code())} onClick={props.state.totpConfirm}>
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
          <div class="grid gap-5">
            <article class="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <h2 class="font-semibold">{messageTranslate("account.recovery.summary")}</h2>
              <p class="mt-2 text-sm text-muted-foreground">
                {messageTranslate("account.recovery.remaining", {
                  count: props.state.methods().recoveryCodes.remaining,
                })}
              </p>
              <Button
                class="mt-5"
                disabled={props.state.pendingId() === "recovery:generate"}
                onClick={props.state.recoveryCodesGenerate}
              >
                {messageTranslate("account.recovery.generate")}
              </Button>
            </article>
            <Show when={props.state.oneTimeCodes().length > 0}>
              <article
                class="rounded-2xl border border-accent/40 bg-surface p-5 shadow-sm"
                data-one-time-secret="recovery-codes"
              >
                <h2 class="font-semibold">{messageTranslate("account.recovery.saveNow")}</h2>
                <p class="mt-2 text-sm text-muted-foreground">{messageTranslate("account.recovery.once")}</p>
                <ul class="mt-4 grid gap-2 rounded-xl bg-muted p-4 font-mono text-sm sm:grid-cols-2">
                  <For each={props.state.oneTimeCodes()}>{(code) => <li>{code}</li>}</For>
                </ul>
                <Button class="mt-5" onClick={props.state.oneTimeCodesDismiss} variant="outline">
                  {messageTranslate("account.recovery.saved")}
                </Button>
              </article>
            </Show>
          </div>
        </Match>
        <Match when={props.state.status() === "ready" && props.state.screen() === "identities"}>
          <div class="grid gap-4">
            <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
              {messageTranslate("account.identities.description")}
            </p>
            <Show
              when={props.state.identities().length > 0}
              fallback={<EmptyState title={messageTranslate("account.identities.empty")} />}
            >
              <For each={props.state.identities()}>
                {(identity) => (
                  <article class="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div>
                        <h2 class="font-semibold capitalize">{identity.providerType}</h2>
                        <p class="mt-1 text-sm text-muted-foreground">
                          {identity.email ?? identity.username ?? identity.displayName ?? identity.externalSubject}
                        </p>
                      </div>
                      <Button
                        disabled={props.state.pendingId() === `identity:${identity.providerId}`}
                        onClick={() => props.state.identityUnlink(identity.providerId, identity.externalSubject)}
                        variant="outline"
                      >
                        {messageTranslate("account.identities.unlink")}
                      </Button>
                    </div>
                  </article>
                )}
              </For>
            </Show>
          </div>
        </Match>
      </Switch>
    </section>
  )
}

function EmptyState(props: { readonly title: string }) {
  return (
    <div class="rounded-2xl border border-dashed border-line-strong bg-muted/40 p-10 text-center">
      <h2 class="font-semibold">{props.title}</h2>
    </div>
  )
}

function SummaryCard(props: { readonly title: string; readonly value: string }) {
  return (
    <article class="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 class="text-sm font-medium text-muted-foreground">{props.title}</h2>
      <p class="mt-2 text-lg font-semibold">{props.value}</p>
    </article>
  )
}
