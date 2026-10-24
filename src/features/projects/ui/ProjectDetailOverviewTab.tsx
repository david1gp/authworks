import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { projectAdminOverviewTabStateCreate } from "./projectAdminOverviewTabStateCreate.js"

/** Overview tab: name, the two enforcement flags with help text, and Save. */
export function ProjectDetailOverviewTab(props: {
  readonly owned: boolean
  readonly state: ReturnType<typeof projectAdminOverviewTabStateCreate>
}) {
  const state = props.state
  return (
    <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
      <Show when={state.page.notice()}>
        {(name) => <AuthenticatedNotice message={messageTranslate("admin.projects.saved", { name: name() })} />}
      </Show>

      <AuthenticatedSection
        description={messageTranslate("admin.projects.overview.settingsDescription")}
        title={messageTranslate("admin.projects.overview.settingsTitle")}
      >
        <form
          class="grid max-w-3xl gap-4 px-5 py-4"
          onSubmit={props.owned ? state.settingsSubmit : (event) => event.preventDefault()}
        >
          <div class="grid min-w-0 gap-1.5">
            <Label class="text-[0.8125rem] font-medium" for="project-overview-name">
              {messageTranslate("admin.projects.list.name")}
            </Label>
            <AuthenticatedInput
              disabled={!props.owned}
              id="project-overview-name"
              onInput={(event) => state.name.set(event.currentTarget.value)}
              value={state.name.get()}
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label
              class={`grid content-start gap-1 rounded-control border border-line bg-muted/40 p-4 ${props.owned ? "cursor-pointer" : "opacity-70"}`}
              for="project-authorization-required"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium">
                  {messageTranslate("admin.projects.overview.authorizationTitle")}
                </span>
                <input
                  checked={state.authorizationRequired.get()}
                  class={authenticatedControlClasses.checkbox}
                  disabled={!props.owned}
                  id="project-authorization-required"
                  onChange={(event) => state.authorizationRequired.set(event.currentTarget.checked)}
                  type="checkbox"
                />
              </span>
              <span class="text-xs text-muted-foreground">
                {messageTranslate("admin.projects.detail.authorizationHelp")}
              </span>
            </label>
            <label
              class={`grid content-start gap-1 rounded-control border border-line bg-muted/40 p-4 ${props.owned ? "cursor-pointer" : "opacity-70"}`}
              for="project-access-required"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium">
                  {messageTranslate("admin.projects.overview.projectAccessTitle")}
                </span>
                <input
                  checked={state.projectAccessRequired.get()}
                  class={authenticatedControlClasses.checkbox}
                  disabled={!props.owned}
                  id="project-access-required"
                  onChange={(event) => state.projectAccessRequired.set(event.currentTarget.checked)}
                  type="checkbox"
                />
              </span>
              <span class="text-xs text-muted-foreground">
                {messageTranslate("admin.projects.detail.projectAccessHelp")}
              </span>
            </label>
          </div>

          <Show when={props.owned}>
            <div class="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-4">
              <AuthenticatedButton
                disabled={state.page.pendingId() !== undefined}
                icon={mdiContentSave}
                type="submit"
                variant="filledBlue"
              >
                {messageTranslate("common.save")}
              </AuthenticatedButton>
            </div>
          </Show>
        </form>
      </AuthenticatedSection>

      <Show when={state.page.project()}>
        {(project) => (
          <AuthenticatedSection title={messageTranslate("admin.projects.overview.title")}>
            <dl class="grid gap-x-6 gap-y-4 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div class="min-w-0">
                <dt class="text-xs font-medium text-muted-foreground">
                  {messageTranslate("admin.projects.detail.created")}
                </dt>
                <dd class="mt-1 font-medium">
                  {localeDateFormat(project().createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-xs font-medium text-muted-foreground">
                  {messageTranslate("admin.projects.detail.updated")}
                </dt>
                <dd class="mt-1 font-medium">
                  {localeDateFormat(project().updatedAt, { dateStyle: "medium", timeStyle: "short" })}
                </dd>
              </div>
            </dl>
          </AuthenticatedSection>
        )}
      </Show>
    </div>
  )
}
