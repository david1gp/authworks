import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { machineAdminCredentialFormStateCreate } from "./machineAdminCredentialFormStateCreate.js"

/** The shared issue form for personal access tokens and API keys. */
export function MachineAdminCredentialForm(props: {
  readonly kindSet: (kind: "api_key" | "personal_access_token") => void
  readonly state: ReturnType<typeof machineAdminCredentialFormStateCreate>
}) {
  const state = props.state
  return (
    <form class="grid gap-3" onSubmit={state.submit}>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="grid min-w-0 gap-1">
          <Label for="machine-credential-kind">{messageTranslate("admin.machine.credentials.kind")}</Label>
          <SelectSingleNative
            getOptions={() => ["personal_access_token", "api_key"]}
            id="machine-credential-kind"
            valueSignal={{
              get: state.kind,
              set: (kind) => props.kindSet(kind as "api_key" | "personal_access_token"),
            }}
            valueText={(kind) =>
              kind === "api_key"
                ? messageTranslate("admin.machine.credentials.kindApiKey")
                : messageTranslate("admin.machine.credentials.kindToken")
            }
          />
          <p class="text-2xs leading-4 text-muted-foreground">
            {messageTranslate("admin.machine.credentials.kindHint")}
          </p>
        </div>
        <div class="grid min-w-0 gap-1">
          <Label for="machine-credential-name">{messageTranslate("admin.machine.credentials.name")}</Label>
          <Input
            id="machine-credential-name"
            onInput={(event) => state.name.set(event.currentTarget.value)}
            value={state.name.get()}
          />
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="grid min-w-0 gap-1">
          <Label for="machine-credential-scopes">{messageTranslate("admin.machine.credentials.scopes")}</Label>
          <Input
            class="font-mono text-xs"
            id="machine-credential-scopes"
            onInput={(event) => state.scopes.set(event.currentTarget.value)}
            value={state.scopes.get()}
          />
          <p class="text-2xs leading-4 text-muted-foreground">
            {messageTranslate("admin.machine.credentials.scopesHint")}
          </p>
        </div>
        <div class="grid min-w-0 gap-1">
          <Label for="machine-credential-expires">{messageTranslate("admin.machine.credentials.expires")}</Label>
          <Input
            id="machine-credential-expires"
            onInput={(event) => state.expiresAt.set(event.currentTarget.value)}
            type="date"
            value={state.expiresAt.get()}
          />
          <p class="text-2xs leading-4 text-muted-foreground">
            {messageTranslate("admin.machine.credentials.expiresHint")}
          </p>
        </div>
      </div>

      <Show when={state.formError()}>{(message) => <AuthenticatedNotice message={message()} tone="danger" />}</Show>

      {/* The issued value is shown once, so the warning sits directly above the irreversible action. */}
      <p class="rounded-control border border-line-subtle bg-muted px-2 py-1.5 text-2xs leading-4 text-muted-foreground">
        {messageTranslate("admin.machine.credentials.onceWarning")}
      </p>

      <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
        {messageTranslate("admin.machine.credentials.issue")}
      </Button>
    </form>
  )
}
