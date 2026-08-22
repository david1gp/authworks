import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { UserState } from "../../users/public/userStateSchema.js"
import { AdminUserSecurityView } from "./AdminUserSecurityView.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminUserDetailStateCreate } from "./adminUserDetailStateCreate.js"
import { adminUserStateVariant } from "./adminUserStateVariant.js"

const lifecycleChoices: readonly UserState[] = ["active", "inactive", "locked", "suspended"]

export function AdminUserDetailView(props: {
  readonly backHref: string
  readonly impersonationHref: string
  readonly state: ReturnType<typeof adminPageStateCreate>
}) {
  const draft = adminUserDetailStateCreate(props.state.user)
  return (
    <section aria-label={messageTranslate("admin.users.detailTitle")} class="grid gap-5">
      <A class="text-sm font-medium text-accent hover:underline" href={props.backHref}>
        ← {messageTranslate("admin.users.title")}
      </A>

      <Show when={props.state.notice()}>
        {(notice) => (
          <p class="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
            {notice()}
          </p>
        )}
      </Show>

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
        <Show when={props.state.user()}>
          {(user) => (
            <>
              <header class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 class="text-2xl font-semibold tracking-tight">
                      {user().profile.displayName ?? user().userName}
                    </h2>
                    <p class="mt-1 font-mono text-xs text-muted-foreground">{user().id}</p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Badge variant={user().emailVerified ? "filledGreen" : "subtle"}>
                      {user().emailVerified
                        ? messageTranslate("admin.users.verified")
                        : messageTranslate("admin.users.unverified")}
                    </Badge>
                    <Badge variant={adminUserStateVariant(user().state)}>{user().state}</Badge>
                  </div>
                </div>
                <dl class="mt-6 grid gap-5 sm:grid-cols-2">
                  <DetailItem label={messageTranslate("admin.users.userName")} value={user().userName} />
                  <DetailItem label={messageTranslate("admin.users.email")} value={user().email} />
                  <DetailItem
                    label={messageTranslate("admin.users.created")}
                    value={localeDateFormat(user().createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  />
                  <DetailItem
                    label={messageTranslate("admin.users.updated")}
                    value={localeDateFormat(user().updatedAt, { dateStyle: "medium", timeStyle: "short" })}
                  />
                </dl>
              </header>

              <Show when={props.state.status() !== "deleted"}>
                <form
                  class="rounded-2xl border border-line bg-surface p-6 shadow-sm"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void props.state.userProfileSave(draft.draft())
                  }}
                >
                  <h3 class="font-semibold">{messageTranslate("admin.users.profileTitle")}</h3>
                  <div class="mt-5 grid gap-4 sm:grid-cols-2">
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
                    {(message) => (
                      <p class="mt-4 text-sm text-danger" role="alert">
                        {message()}
                      </p>
                    )}
                  </Show>
                  <Button class="mt-5" disabled={props.state.pendingId() !== undefined} type="submit">
                    {messageTranslate("admin.users.profileSave")}
                  </Button>
                </form>

                <article class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                  <h3 class="font-semibold">{messageTranslate("admin.users.verificationTitle")}</h3>
                  <p class="mt-2 text-sm text-muted-foreground">
                    {messageTranslate("admin.users.verificationDescription")}
                  </p>
                  <div class="mt-5 flex flex-wrap gap-3">
                    <Button
                      disabled={user().verificationState === "verified" || props.state.pendingId() !== undefined}
                      onClick={() => void props.state.userVerificationSet("verified")}
                      variant="outline"
                    >
                      {messageTranslate("admin.users.markVerified")}
                    </Button>
                    <Button
                      disabled={user().verificationState === "unverified" || props.state.pendingId() !== undefined}
                      onClick={() => void props.state.userVerificationSet("unverified")}
                      variant="outline"
                    >
                      {messageTranslate("admin.users.markUnverified")}
                    </Button>
                  </div>
                </article>

                <article class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                  <h3 class="font-semibold">{messageTranslate("admin.users.lifecycleTitle")}</h3>
                  <p class="mt-2 text-sm text-muted-foreground">
                    {messageTranslate("admin.users.lifecycleDescription")}
                  </p>
                  <div class="mt-5 flex flex-wrap gap-3">
                    <For each={lifecycleChoices}>
                      {(choice) => (
                        <Button
                          disabled={user().state === choice || props.state.pendingId() !== undefined}
                          onClick={() => void props.state.userLifecycleSet(choice)}
                          variant="outline"
                        >
                          {messageTranslate(`admin.users.lifecycle.${choice}`)}
                        </Button>
                      )}
                    </For>
                  </div>
                </article>

                {/* Impersonation is only offered for an eligible, active user; the guarded
                    form on the destination re-checks permission and assurance. */}
                <Show when={user().state === "active"}>
                  <article class="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                    <h3 class="font-semibold">{messageTranslate("admin.impersonation.title")}</h3>
                    <p class="mt-2 text-sm text-muted-foreground">
                      {messageTranslate("admin.impersonation.description")}
                    </p>
                    <A
                      class="mt-5 inline-flex rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-muted"
                      href={`${props.impersonationHref}?userId=${encodeURIComponent(user().id)}`}
                    >
                      {messageTranslate("admin.impersonation.userAction")}
                    </A>
                  </article>
                </Show>

                <AdminUserSecurityView state={props.state.userSecurity} />

                <article class="rounded-2xl border border-danger/40 bg-danger/5 p-6 shadow-sm">
                  <h3 class="font-semibold text-danger">{messageTranslate("admin.users.dangerZone")}</h3>
                  <p class="mt-2 text-sm text-muted-foreground">{messageTranslate("admin.users.deleteWarning")}</p>
                  <Button
                    class="mt-5"
                    disabled={props.state.pendingId() !== undefined}
                    onClick={() => void props.state.userDelete()}
                    variant="outline"
                  >
                    {messageTranslate("admin.users.delete")}
                  </Button>
                </article>
              </Show>
            </>
          )}
        </Show>
      </Show>
    </section>
  )
}

function DetailItem(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt class="text-sm text-muted-foreground">{props.label}</dt>
      <dd class="mt-1 break-all text-sm font-medium">{props.value}</dd>
    </div>
  )
}

function ProfileField(props: {
  readonly id: string
  readonly label: string
  readonly onInput: (value: string) => void
  readonly value: string
}) {
  return (
    <div class="grid gap-2">
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
