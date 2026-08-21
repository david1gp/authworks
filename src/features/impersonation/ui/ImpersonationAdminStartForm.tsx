import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { impersonationAdminDurationOptions } from "./impersonationAdminDurationOptions.js"
import type { ImpersonationAdminPageState } from "./impersonationAdminPageStateCreate.js"

/**
 * The guarded start form. A target, a mandatory reason, and a bounded duration are always
 * required, and the destructive start is confirmed before any request is sent.
 */
export function ImpersonationAdminStartForm(props: { readonly state: ImpersonationAdminPageState }) {
  const state = props.state
  return (
    <form
      class="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void state.impersonationStart()
      }}
    >
      <div class="grid gap-2">
        <Label for="impersonation-target">{messageTranslate("admin.impersonation.target")}</Label>
        <select
          class="rounded-md border border-line bg-surface px-3 py-2 text-sm text-foreground"
          id="impersonation-target"
          onChange={(event) => state.targetUserId.set(event.currentTarget.value)}
          value={state.targetUserId.get()}
        >
          <For each={state.users()}>
            {(user) => (
              <option disabled={user.state !== "active"} value={user.id}>
                {state.userLabel(user)}
              </option>
            )}
          </For>
        </select>
      </div>

      <div class="grid gap-2">
        <Label for="impersonation-organization">{messageTranslate("admin.impersonation.organization")}</Label>
        <select
          class="rounded-md border border-line bg-surface px-3 py-2 text-sm text-foreground"
          id="impersonation-organization"
          onChange={(event) => state.organizationId.set(event.currentTarget.value)}
          value={state.organizationId.get()}
        >
          <option value="">{messageTranslate("admin.impersonation.noOrganization")}</option>
          <For each={state.organizations()}>
            {(organization) => <option value={organization.id}>{organization.name}</option>}
          </For>
        </select>
        <p class="text-xs text-muted-foreground">{messageTranslate("admin.impersonation.organizationHint")}</p>
      </div>

      <div class="grid gap-2">
        <Label for="impersonation-reason">{messageTranslate("admin.impersonation.reason")}</Label>
        <Input
          id="impersonation-reason"
          maxlength={256}
          onInput={(event) => state.reason.set(event.currentTarget.value)}
          required
          value={state.reason.get()}
        />
        <p class="text-xs text-muted-foreground">{messageTranslate("admin.impersonation.reasonHint")}</p>
      </div>

      <div class="grid gap-2">
        <Label for="impersonation-duration">{messageTranslate("admin.impersonation.duration")}</Label>
        <select
          class="rounded-md border border-line bg-surface px-3 py-2 text-sm text-foreground"
          id="impersonation-duration"
          onChange={(event) => state.durationSeconds.set(Number(event.currentTarget.value))}
          value={String(state.durationSeconds.get())}
        >
          <For each={impersonationAdminDurationOptions}>
            {(seconds) => (
              <option value={String(seconds)}>
                {messageTranslate("admin.impersonation.durationMinutes", { count: seconds / 60 })}
              </option>
            )}
          </For>
        </select>
        <p class="text-xs text-muted-foreground">{messageTranslate("admin.impersonation.durationHint")}</p>
      </div>

      <Show when={state.validationMessage()}>
        {(message) => (
          <p class="text-sm text-danger" role="alert">
            {message()}
          </p>
        )}
      </Show>

      <Button disabled={state.pendingId() !== undefined} type="submit" variant="filledAmber">
        {messageTranslate("admin.impersonation.start")}
      </Button>
    </form>
  )
}
