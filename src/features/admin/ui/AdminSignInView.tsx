import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"

/**
 * Administrator sign-in and the realm session it produces. The bootstrap credential is only
 * submitted; the view never renders, echoes, or otherwise persists it.
 */
export function AdminSignInView(props: { readonly state: ReturnType<typeof adminPageStateCreate> }) {
  return (
    <section aria-label={messageTranslate("admin.signIn.title")} class="grid min-w-0 max-w-3xl gap-3 [&>*]:min-w-0">
      <Show when={props.state.status() === "loading"}>
        <ProductionStatePanel state="loading" />
      </Show>

      <Show when={props.state.status() === "signed-in" && props.state.session()}>
        {(session) => (
          <div data-admin-session="active">
            <AuthenticatedSection
              actions={
                <Button
                  class="gap-1.5"
                  disabled={props.state.pendingId() === "session:sign-out"}
                  onClick={props.state.adminSignOut}
                  size="sm"
                  variant="outline"
                >
                  <Icon path={mdiLogout} />
                  {messageTranslate("common.signOut")}
                </Button>
              }
              description={messageTranslate("admin.signIn.expiresAt", {
                date: localeDateFormat(session().expiresAt, { dateStyle: "medium", timeStyle: "short" }),
              })}
              padded
              title={messageTranslate("admin.signIn.activeTitle")}
            >
              <AuthenticatedFieldList
                fields={[
                  { identifier: true, label: messageTranslate("admin.signIn.subject"), value: session().subjectId },
                  { label: messageTranslate("admin.signIn.subjectType"), value: session().subjectType },
                ]}
              />
            </AuthenticatedSection>
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
        <AuthenticatedSection
          description={messageTranslate("admin.signIn.description")}
          title={messageTranslate("admin.signIn.title")}
        >
          <form class="grid gap-3 px-3 py-3" onSubmit={props.state.adminSignInSubmit}>
            <div class="grid gap-1">
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
              {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
            </Show>
            <Show when={props.state.error()}>
              {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
            </Show>
            <div>
              <Button size="sm" type="submit">
                {messageTranslate("common.signIn")}
              </Button>
            </div>
          </form>
        </AuthenticatedSection>
      </Show>
    </section>
  )
}
