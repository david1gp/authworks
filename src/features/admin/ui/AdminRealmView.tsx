import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

const fieldClass = "grid gap-1"

export function AdminRealmView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.realm.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <Show when={props.state.notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>

      <Show when={props.state.status() === "permission-denied" && props.state.realm()}>
        <AuthenticatedNotice message={messageTranslate("admin.realm.permissionDenied")} tone="danger" />
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
            state={adminViewStatusPanelState(props.state.status())}
          />
        }
      >
        <Show when={props.state.realm()}>
          {(realm) => (
            <>
              <AuthenticatedSection
                actions={
                  <AuthenticatedStatus
                    label={
                      realm().status === "active"
                        ? messageTranslate("admin.realm.statusActive")
                        : messageTranslate("admin.realm.statusDisabled")
                    }
                    tone={realm().status === "active" ? "success" : "danger"}
                  />
                }
                padded
                title={realm().name}
              >
                <AuthenticatedFieldList
                  columns={3}
                  fields={[
                    { identifier: true, label: messageTranslate("admin.realm.identifier"), value: realm().id },
                    { label: messageTranslate("admin.realm.primaryDomain"), value: realm().domain },
                    {
                      label: messageTranslate("admin.realm.updated"),
                      value: localeDateFormat(realm().updatedAt, { dateStyle: "medium", timeStyle: "short" }),
                    },
                  ]}
                />
              </AuthenticatedSection>

              <Show when={props.state.status() !== "permission-denied"}>
                <AuthenticatedSection
                  description={messageTranslate("admin.realm.settingsDescription")}
                  title={messageTranslate("admin.realm.settingsTitle")}
                >
                  <form class="grid gap-3 px-3 py-3" onSubmit={props.state.realmSave}>
                    <div class="grid gap-3 sm:grid-cols-2">
                      <div class={fieldClass}>
                        <Label for="admin-realm-name">{messageTranslate("admin.realm.name")}</Label>
                        <Input
                          id="admin-realm-name"
                          maxlength={128}
                          onInput={(event) => props.state.realmName.set(event.currentTarget.value)}
                          value={props.state.realmName.get()}
                        />
                      </div>
                      <div class={fieldClass}>
                        <Label for="admin-realm-status">{messageTranslate("admin.realm.status")}</Label>
                        <select
                          class="h-9 w-full rounded-control border border-line bg-surface px-2 text-sm text-foreground"
                          id="admin-realm-status"
                          onChange={(event) =>
                            props.state.realmStatus.set(
                              event.currentTarget.value === "disabled" ? "disabled" : "active",
                            )
                          }
                          value={props.state.realmStatus.get()}
                        >
                          <option value="active">{messageTranslate("admin.realm.statusActive")}</option>
                          <option value="disabled">{messageTranslate("admin.realm.statusDisabled")}</option>
                        </select>
                      </div>
                    </div>
                    <div class={fieldClass}>
                      <Label for="admin-realm-domains">{messageTranslate("admin.realm.domains")}</Label>
                      <Input
                        id="admin-realm-domains"
                        onInput={(event) => props.state.realmDomains.set(event.currentTarget.value)}
                        value={props.state.realmDomains.get()}
                      />
                      <p class="text-xs text-muted-foreground">{messageTranslate("admin.realm.domainsHint")}</p>
                    </div>
                    <Show when={props.state.validationMessage()}>
                      {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                    </Show>
                    <div>
                      <Button disabled={props.state.pendingId() !== undefined} size="sm" type="submit">
                        {messageTranslate("admin.realm.save")}
                      </Button>
                    </div>
                  </form>
                </AuthenticatedSection>

                <AuthenticatedSection
                  actions={<AuthenticatedStatus label={messageTranslate("admin.realm.dangerZone")} tone="danger" />}
                  class="border-danger/35"
                  padded
                  title={messageTranslate("admin.realm.lifecycleTitle")}
                >
                  <Show
                    when={realm().status === "active"}
                    fallback={
                      <div class="flex flex-wrap items-center justify-between gap-3">
                        <p class="min-w-0 text-xs text-muted-foreground">
                          {messageTranslate("admin.realm.enableDescription")}
                        </p>
                        <Button
                          disabled={props.state.pendingId() === "realm:lifecycle:active"}
                          onClick={() => props.state.realmLifecycleApply("active")}
                          size="sm"
                        >
                          {messageTranslate("admin.realm.enable")}
                        </Button>
                      </div>
                    }
                  >
                    <p class="text-xs text-muted-foreground">{messageTranslate("admin.realm.disableWarning")}</p>
                    <div class="mt-2.5 grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div class={`${fieldClass} min-w-0`}>
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
                        disabled={props.state.pendingId() === "realm:lifecycle:disabled"}
                        onClick={() => props.state.realmLifecycleApply("disabled")}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("admin.realm.disable")}
                      </Button>
                    </div>
                  </Show>
                </AuthenticatedSection>
              </Show>
            </>
          )}
        </Show>
      </Show>
    </section>
  )
}
