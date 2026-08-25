import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"

/**
 * Administrator sign-in. The bootstrap credential is only submitted; the view never renders,
 * echoes, or otherwise persists it.
 */
export function AdminSignInView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.signIn.title")} class="mx-auto grid w-full max-w-2xl gap-5">
      <Show when={props.state.status() === "loading"}>
        <ProductionStatePanel state="loading" />
      </Show>

      <Show when={props.state.status() === "signed-in" && props.state.session()}>
        {(session) => (
          <div class="rounded-2xl border border-line bg-surface p-6 shadow-sm" data-admin-session="active">
            <h2 class="text-xl font-semibold">{messageTranslate("admin.signIn.activeTitle")}</h2>
            <p class="mt-2 text-sm text-muted-foreground">
              {messageTranslate("admin.signIn.expiresAt", {
                date: localeDateFormat(session().expiresAt, { dateStyle: "medium", timeStyle: "short" }),
              })}
            </p>
            <dl class="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {messageTranslate("admin.signIn.subject")}
                </dt>
                <dd class="mt-1 break-all font-medium">{session().subjectId}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {messageTranslate("admin.signIn.subjectType")}
                </dt>
                <dd class="mt-1 break-all font-medium">{session().subjectType}</dd>
              </div>
            </dl>
            <Button
              class="mt-6 gap-2"
              disabled={props.state.pendingId() === "session:sign-out"}
              onClick={props.state.adminSignOut}
              variant="outline"
            >
              <Icon path={mdiLogout} />
              {messageTranslate("common.signOut")}
            </Button>
          </div>
        )}
      </Show>

      <Show when={props.state.status() === "signed-out"}>
        <ProductionStatePanel
          detail={messageTranslate("admin.signIn.signedOutDetail")}
          state="empty"
          title={messageTranslate("admin.signIn.signedOutTitle")}
        />
      </Show>

      <Show
        when={
          props.state.status() === "ready" ||
          props.state.status() === "error" ||
          props.state.status() === "expired" ||
          props.state.status() === "signed-out"
        }
      >
        <form class="rounded-2xl border border-line bg-surface p-6 shadow-sm" onSubmit={props.state.adminSignInSubmit}>
          <h2 class="text-xl font-semibold">{messageTranslate("admin.signIn.title")}</h2>
          <p class="mt-2 text-sm leading-6 text-muted-foreground">{messageTranslate("admin.signIn.description")}</p>
          <div class="mt-6 grid gap-2">
            <Label for="admin-bootstrap-secret">{messageTranslate("admin.signIn.credential")}</Label>
            <Input
              autocomplete="off"
              id="admin-bootstrap-secret"
              name="bootstrap-secret"
              onInput={(event) => props.state.signInSecret.set(event.currentTarget.value)}
              spellcheck={false}
              type="password"
              value={props.state.signInSecret.get()}
            />
            <p class="text-xs text-muted-foreground">{messageTranslate("admin.signIn.credentialNotStored")}</p>
          </div>
          <Show when={props.state.validationMessage()}>
            {(message) => (
              <p class="mt-4 text-sm text-danger" role="alert">
                {message()}
              </p>
            )}
          </Show>
          <Show when={props.state.error()}>
            {(message) => (
              <p class="mt-4 text-sm text-danger" role="alert">
                {message()}
              </p>
            )}
          </Show>
          <Button class="mt-6" type="submit">
            {messageTranslate("common.signIn")}
          </Button>
        </form>
      </Show>
    </section>
  )
}
