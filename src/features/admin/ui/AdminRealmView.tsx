import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"

export function AdminRealmView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.realm.title")} class="grid min-w-0 gap-5 [&>*]:min-w-0">
      <p class="max-w-2xl text-sm leading-6 text-muted-foreground">{messageTranslate("admin.realm.description")}</p>

      <Show when={props.state.notice()}>
        {(notice) => (
          <p class="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
            {notice()}
          </p>
        )}
      </Show>

      <Show when={props.state.status() === "permission-denied" && props.state.realm()}>
        <p class="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          {messageTranslate("admin.realm.permissionDenied")}
        </p>
      </Show>

      <Show
        when={props.state.status() === "ready" || (props.state.status() === "permission-denied" && props.state.realm())}
        fallback={
          <ProductionStatePanel
            detail={
              props.state.status() === "permission-denied"
                ? messageTranslate("admin.common.permission")
                : props.state.error()
            }
            onRetry={props.state.status() === "error" ? props.state.reload : undefined}
            state={
              props.state.status() === "loading"
                ? "loading"
                : props.state.status() === "permission-denied" || props.state.status() === "expired"
                  ? "inaccessible"
                  : "error"
            }
          />
        }
      >
        <Show when={props.state.realm()}>
          {(realm) => (
            <>
              <header class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <h2 class="break-words text-2xl font-semibold tracking-tight">{realm().name}</h2>
                    <p class="mt-1 break-all font-mono text-xs text-muted-foreground">{realm().id}</p>
                  </div>
                  <Badge variant={realm().status === "active" ? "filledGreen" : "filledRed"}>{realm().status}</Badge>
                </div>
                <p class="mt-4 text-sm text-muted-foreground">
                  {messageTranslate("admin.realm.updated")}:{" "}
                  {localeDateFormat(realm().updatedAt, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </header>

              <form class="rounded-2xl border border-line bg-surface p-6 shadow-sm" onSubmit={props.state.realmSave}>
                <h3 class="font-semibold">{messageTranslate("admin.realm.settingsTitle")}</h3>
                <div class="mt-5 grid gap-4">
                  <div class="grid gap-2">
                    <Label for="admin-realm-name">{messageTranslate("admin.realm.name")}</Label>
                    <Input
                      id="admin-realm-name"
                      maxlength={128}
                      onInput={(event) => props.state.realmName.set(event.currentTarget.value)}
                      value={props.state.realmName.get()}
                    />
                  </div>
                  <div class="grid gap-2">
                    <Label for="admin-realm-domains">{messageTranslate("admin.realm.domains")}</Label>
                    <Input
                      id="admin-realm-domains"
                      onInput={(event) => props.state.realmDomains.set(event.currentTarget.value)}
                      value={props.state.realmDomains.get()}
                    />
                    <p class="text-xs text-muted-foreground">{messageTranslate("admin.realm.domainsHint")}</p>
                  </div>
                  <div class="grid gap-2">
                    <Label for="admin-realm-status">{messageTranslate("admin.realm.status")}</Label>
                    <select
                      class="block w-full rounded-lg border border-line bg-surface p-2.5"
                      id="admin-realm-status"
                      onChange={(event) =>
                        props.state.realmStatus.set(event.currentTarget.value === "disabled" ? "disabled" : "active")
                      }
                      value={props.state.realmStatus.get()}
                    >
                      <option value="active">{messageTranslate("admin.realm.statusActive")}</option>
                      <option value="disabled">{messageTranslate("admin.realm.statusDisabled")}</option>
                    </select>
                  </div>
                </div>
                <Show when={props.state.validationMessage()}>
                  {(message) => (
                    <p class="mt-4 text-sm text-danger" role="alert">
                      {message()}
                    </p>
                  )}
                </Show>
                <Button class="mt-5" disabled={props.state.pendingId() !== undefined} type="submit">
                  {messageTranslate("admin.realm.save")}
                </Button>
              </form>

              <section class="rounded-2xl border border-danger/40 bg-surface p-6 shadow-sm">
                <p class="text-xs font-bold uppercase tracking-[0.16em] text-danger">
                  {messageTranslate("admin.realm.dangerZone")}
                </p>
                <h3 class="mt-2 font-semibold">{messageTranslate("admin.realm.lifecycleTitle")}</h3>
                <Show
                  when={realm().status === "active"}
                  fallback={
                    <div>
                      <p class="mt-3 text-sm leading-6 text-muted-foreground">
                        {messageTranslate("admin.realm.enableDescription")}
                      </p>
                      <Button
                        class="mt-5"
                        disabled={props.state.pendingId() === "realm:lifecycle:active"}
                        onClick={() => props.state.realmLifecycleApply("active")}
                      >
                        {messageTranslate("admin.realm.enable")}
                      </Button>
                    </div>
                  }
                >
                  <p class="mt-3 text-sm leading-6 text-muted-foreground">
                    {messageTranslate("admin.realm.disableWarning")}
                  </p>
                  <div class="mt-5 grid gap-2">
                    <Label for="admin-realm-confirm">
                      {messageTranslate("admin.realm.confirmLabel", { name: realm().name })}
                    </Label>
                    <Input
                      autocomplete="off"
                      id="admin-realm-confirm"
                      onInput={(event) => props.state.lifecycleConfirmation.set(event.currentTarget.value)}
                      value={props.state.lifecycleConfirmation.get()}
                    />
                  </div>
                  <Button
                    class="mt-5"
                    disabled={props.state.pendingId() === "realm:lifecycle:disabled"}
                    onClick={() => props.state.realmLifecycleApply("disabled")}
                    variant="outline"
                  >
                    {messageTranslate("admin.realm.disable")}
                  </Button>
                </Show>
              </section>
            </>
          )}
        </Show>
      </Show>
    </section>
  )
}
