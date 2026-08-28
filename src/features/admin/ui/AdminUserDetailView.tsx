import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
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
import type { UserState } from "../../users/public/userStateSchema.js"
import { AdminUserSecurityView } from "./AdminUserSecurityView.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminUserDetailStateCreate } from "./adminUserDetailStateCreate.js"
import { adminUserStateTone } from "./adminUserStateTone.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

const lifecycleChoices: readonly UserState[] = ["active", "inactive", "locked", "suspended"]

export function AdminUserDetailView(props: {
  readonly backHref: string
  readonly impersonationHref: string
  readonly state: ReturnType<typeof adminPageStateCreate>
}) {
  const draft = adminUserDetailStateCreate(props.state.user)
  return (
    <section aria-label={messageTranslate("admin.users.detailTitle")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <A class="text-xs font-medium text-accent hover:underline" href={props.backHref}>
        {messageTranslate("admin.users.backToDirectory")}
      </A>

      <Show when={props.state.notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>

      <Show
        when={props.state.status() === "ready" || props.state.status() === "deleted"}
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
        <Show when={props.state.user()}>
          {(user) => (
            <>
              <AuthenticatedSection
                actions={
                  <>
                    <AuthenticatedStatus
                      label={
                        user().emailVerified
                          ? messageTranslate("admin.users.verified")
                          : messageTranslate("admin.users.unverified")
                      }
                      tone={user().emailVerified ? "success" : "neutral"}
                    />
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.users.lifecycle.${user().state}`)}
                      tone={adminUserStateTone(user().state)}
                    />
                    <Show when={user().state === "active" && props.state.status() !== "deleted"}>
                      <A
                        class="inline-flex h-7 items-center rounded-control border border-line px-2 text-xs font-medium hover:bg-surface-hover"
                        href={`${props.impersonationHref}?userId=${encodeURIComponent(user().id)}`}
                      >
                        {messageTranslate("admin.impersonation.userAction")}
                      </A>
                    </Show>
                  </>
                }
                padded
                title={user().profile.displayName ?? user().userName}
              >
                <div class="flex items-start gap-3">
                  <Show when={user().profile.picture?.url}>
                    {(url) => (
                      <img
                        alt={messageTranslate("admin.users.pictureAlt")}
                        class="size-10 shrink-0 rounded-full border border-line object-cover"
                        src={url()}
                      />
                    )}
                  </Show>
                  <AuthenticatedFieldList
                    class="flex-1"
                    columns={3}
                    fields={[
                      { identifier: true, label: messageTranslate("admin.users.identifier"), value: user().id },
                      { label: messageTranslate("admin.users.userName"), value: user().userName },
                      { label: messageTranslate("admin.users.email"), value: user().email },
                      {
                        label: messageTranslate("admin.users.createdAt"),
                        value: localeDateFormat(user().createdAt, { dateStyle: "medium", timeStyle: "short" }),
                      },
                      {
                        label: messageTranslate("admin.users.updated"),
                        value: localeDateFormat(user().updatedAt, { dateStyle: "medium", timeStyle: "short" }),
                      },
                    ]}
                  />
                </div>
              </AuthenticatedSection>

              <Show when={props.state.status() !== "deleted"}>
                <AuthenticatedSection title={messageTranslate("admin.users.profileTitle")}>
                  <form
                    class="grid gap-3 px-3 py-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void props.state.userProfileSave(draft.draft())
                    }}
                  >
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <ProfileField
                        id="admin-user-display-name-edit"
                        label={messageTranslate("admin.users.displayName")}
                        onInput={draft.displayName.set}
                        value={draft.displayName.get()}
                      />
                      <ProfileField
                        id="admin-user-first-name"
                        label={messageTranslate("admin.users.firstName")}
                        onInput={draft.firstName.set}
                        value={draft.firstName.get()}
                      />
                      <ProfileField
                        id="admin-user-last-name"
                        label={messageTranslate("admin.users.lastName")}
                        onInput={draft.lastName.set}
                        value={draft.lastName.get()}
                      />
                      <ProfileField
                        id="admin-user-nick-name"
                        label={messageTranslate("admin.users.nickName")}
                        onInput={draft.nickName.set}
                        value={draft.nickName.get()}
                      />
                      <ProfileField
                        id="admin-user-language"
                        label={messageTranslate("admin.users.preferredLanguage")}
                        onInput={draft.preferredLanguage.set}
                        value={draft.preferredLanguage.get()}
                      />
                    </div>
                    <Show when={props.state.validationMessage()}>
                      {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                    </Show>
                    <div>
                      <Button disabled={props.state.pendingId() !== undefined} size="sm" type="submit">
                        {messageTranslate("admin.users.profileSave")}
                      </Button>
                    </div>
                  </form>
                </AuthenticatedSection>

                <div class="grid min-w-0 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
                  <AuthenticatedSection
                    description={messageTranslate("admin.users.verificationDescription")}
                    padded
                    title={messageTranslate("admin.users.verificationTitle")}
                  >
                    <div class="flex flex-wrap gap-2">
                      <Button
                        disabled={user().verificationState === "verified" || props.state.pendingId() !== undefined}
                        onClick={() => void props.state.userVerificationSet("verified")}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("admin.users.markVerified")}
                      </Button>
                      <Button
                        disabled={user().verificationState === "unverified" || props.state.pendingId() !== undefined}
                        onClick={() => void props.state.userVerificationSet("unverified")}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("admin.users.markUnverified")}
                      </Button>
                    </div>
                  </AuthenticatedSection>

                  <AuthenticatedSection
                    description={messageTranslate("admin.users.lifecycleDescription")}
                    padded
                    title={messageTranslate("admin.users.lifecycleTitle")}
                  >
                    <div class="flex flex-wrap gap-2">
                      <For each={lifecycleChoices}>
                        {(choice) => (
                          <Button
                            disabled={user().state === choice || props.state.pendingId() !== undefined}
                            onClick={() => void props.state.userLifecycleSet(choice)}
                            size="sm"
                            variant="outline"
                          >
                            {messageTranslate(`admin.users.lifecycle.${choice}`)}
                          </Button>
                        )}
                      </For>
                    </div>
                  </AuthenticatedSection>
                </div>

                <AdminUserSecurityView state={props.state.userSecurity} />

                <AuthenticatedSection
                  actions={
                    <Button
                      disabled={props.state.pendingId() !== undefined}
                      onClick={() => void props.state.userDelete()}
                      size="sm"
                      variant="outline"
                    >
                      {messageTranslate("admin.users.delete")}
                    </Button>
                  }
                  class="border-danger/35"
                  padded
                  title={messageTranslate("admin.users.dangerZone")}
                >
                  <p class="text-xs text-muted-foreground">{messageTranslate("admin.users.deleteWarning")}</p>
                </AuthenticatedSection>
              </Show>
            </>
          )}
        </Show>
      </Show>
    </section>
  )
}

function ProfileField(props: {
  readonly id: string
  readonly label: string
  readonly onInput: (value: string) => void
  readonly value: string
}) {
  return (
    <div class="grid gap-1">
      <Label for={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        maxlength={128}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        value={props.value}
      />
    </div>
  )
}
