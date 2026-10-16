import { mdiLogin } from "@adaptive-ds/mdi/mdiLogin.js"
import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
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
    <AuthenticatedPageBody class="max-w-3xl">
      <Show when={props.state.status() === "loading"}>
        <ProductionStatePanel state="loading" />
      </Show>

      <Show when={props.state.status() === "signed-in" && props.state.session()}>
        {(session) => (
          <div data-admin-session="active">
            <AuthenticatedSection
              class="in-[[data-shell=focus]]:rounded-none in-[[data-shell=focus]]:border-0 in-[[data-shell=focus]]:bg-transparent in-[[data-shell=focus]]:shadow-none in-[[data-shell=focus]]:[&>div]:border-0 in-[[data-shell=focus]]:[&>div]:px-0 in-[[data-shell=focus]]:[&>div:first-child]:pt-0 in-[[data-shell=focus]]:[&>div:last-child]:pb-0"
              actions={
                <AuthenticatedButton
                  size="sm"
                  icon={mdiLogout}
                  disabled={props.state.pendingId() === "session:sign-out"}
                  onClick={props.state.adminSignOut}
                  variant="outline"
                >
                  {messageTranslate("common.signOut")}
                </AuthenticatedButton>
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
        {/* The page heading already reads "Administrator sign-in", so the panel keeps only its
            description instead of repeating that title as a second visible heading. */}
        <AuthenticatedSection
          class="in-[[data-shell=focus]]:rounded-none in-[[data-shell=focus]]:border-0 in-[[data-shell=focus]]:bg-transparent in-[[data-shell=focus]]:shadow-none in-[[data-shell=focus]]:[&>div:first-child]:border-0 in-[[data-shell=focus]]:[&>div:first-child]:px-0 in-[[data-shell=focus]]:[&>div:first-child]:pt-0 in-[[data-shell=focus]]:[&_form]:px-0 in-[[data-shell=focus]]:[&_form]:pb-0"
          description={messageTranslate("admin.signIn.description")}
        >
          <form class="grid max-w-3xl gap-4 px-5 py-5" onSubmit={props.state.adminSignInSubmit}>
            <div class="grid gap-1.5">
              <Label class="text-[0.8125rem] font-medium" for="admin-bootstrap-secret">
                {messageTranslate("admin.signIn.credential")}
              </Label>
              <AuthenticatedInput
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
              <AuthenticatedButton
                class="in-[[data-shell=focus]]:w-full"
                icon={mdiLogin}
                type="submit"
                variant="filledBlue"
              >
                {messageTranslate("common.signIn")}
              </AuthenticatedButton>
            </div>
          </form>
        </AuthenticatedSection>
      </Show>
    </AuthenticatedPageBody>
  )
}
