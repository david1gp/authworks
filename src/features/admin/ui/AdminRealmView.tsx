import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

const fieldClass = "grid gap-1.5"

export function AdminRealmView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.realm.title")} class="grid min-w-0 gap-5 [&>*]:min-w-0">
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
                  <form class="grid max-w-3xl gap-4 px-5 py-5" onSubmit={props.state.realmSave}>
                    <div class="grid gap-4 sm:grid-cols-2">
                      <div class={fieldClass}>
                        <Label class="text-[0.8125rem] font-medium" for="admin-realm-name">
                          {messageTranslate("admin.realm.name")}
                        </Label>
                        <AuthenticatedInput
                          id="admin-realm-name"
                          maxlength={128}
                          onInput={(event) => props.state.realmName.set(event.currentTarget.value)}
                          value={props.state.realmName.get()}
                        />
                      </div>
                      <div class={fieldClass}>
                        <Label class="text-[0.8125rem] font-medium" for="admin-realm-status">
                          {messageTranslate("admin.realm.status")}
                        </Label>
                        <select
                          class={authenticatedControlClasses.select}
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
                      <Label class="text-[0.8125rem] font-medium" for="admin-realm-domains">
                        {messageTranslate("admin.realm.domains")}
                      </Label>
                      <AuthenticatedInput
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
                      <AuthenticatedButton
                        disabled={props.state.pendingId() !== undefined}
                        icon={mdiContentSave}
                        type="submit"
                        variant="filledBlue"
                      >
                        {messageTranslate("admin.realm.save")}
                      </AuthenticatedButton>
                    </div>
                  </form>
                </AuthenticatedSection>

                <AuthenticatedSection
                  actions={<AuthenticatedStatus label={messageTranslate("admin.realm.dangerZone")} tone="danger" />}
                  class="border-danger/35 [&>div:last-child]:max-w-3xl"
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
                        <AuthenticatedButton
                          size="sm"
                          disabled={props.state.pendingId() === "realm:lifecycle:active"}
                          icon={mdiCheckCircle}
                          onClick={() => props.state.realmLifecycleApply("active")}
                        >
                          {messageTranslate("admin.realm.enable")}
                        </AuthenticatedButton>
                      </div>
                    }
                  >
                    <p class="text-xs text-muted-foreground">{messageTranslate("admin.realm.disableWarning")}</p>
                    <div class="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div class={`${fieldClass} min-w-0`}>
                        <Label class="text-[0.8125rem] font-medium" for="admin-realm-confirm">
                          {messageTranslate("admin.realm.confirmLabel", { name: realm().name })}
                        </Label>
                        <AuthenticatedInput
                          autocomplete="off"
                          id="admin-realm-confirm"
                          onInput={(event) => props.state.lifecycleConfirmation.set(event.currentTarget.value)}
                          value={props.state.lifecycleConfirmation.get()}
                        />
                      </div>
                      <AuthenticatedButton
                        size="sm"
                        disabled={props.state.pendingId() === "realm:lifecycle:disabled"}
                        icon={mdiCancel}
                        onClick={() => props.state.realmLifecycleApply("disabled")}
                        variant="outline"
                      >
                        {messageTranslate("admin.realm.disable")}
                      </AuthenticatedButton>
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
