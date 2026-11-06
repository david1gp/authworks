import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { Show } from "solid-js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSettingsList } from "../../../ui/authenticated/AuthenticatedSettingsList.js"
import { AuthenticatedSettingsRow } from "../../../ui/authenticated/AuthenticatedSettingsRow.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { projectAdminOverviewTabStateCreate } from "./projectAdminOverviewTabStateCreate.js"

/** Overview tab: name, the two enforcement flags with help text, and Save. */
export function ProjectDetailOverviewTab(props: {
  readonly owned: boolean
  readonly state: ReturnType<typeof projectAdminOverviewTabStateCreate>
}) {
  const state = props.state
  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedSection
        description={messageTranslate("admin.projects.overview.settingsDescription")}
        title={messageTranslate("admin.projects.overview.settingsTitle")}
      >
        <form
          class="grid gap-3 px-4 py-3"
          onSubmit={props.owned ? state.settingsSubmit : (event) => event.preventDefault()}
        >
          <AuthenticatedSettingsList>
            <AuthenticatedSettingsRow
              label={messageTranslate("admin.projects.list.name")}
              htmlFor="project-overview-name"
            >
              <AuthenticatedInput
                disabled={!props.owned}
                id="project-overview-name"
                onInput={(event) => state.name.set(event.currentTarget.value)}
                value={state.name.get()}
              />
            </AuthenticatedSettingsRow>
            <AuthenticatedSettingsRow
              label={messageTranslate("admin.projects.overview.authorizationTitle")}
              description={messageTranslate("admin.projects.detail.authorizationHelp").replace(/^[^:]+:\s*/, "")}
              htmlFor="project-authorization-required"
            >
              <input
                checked={state.authorizationRequired.get()}
                class={authenticatedControlClasses.checkbox}
                disabled={!props.owned}
                id="project-authorization-required"
                onChange={(event) => state.authorizationRequired.set(event.currentTarget.checked)}
                type="checkbox"
              />
            </AuthenticatedSettingsRow>
            <AuthenticatedSettingsRow
              label={messageTranslate("admin.projects.overview.projectAccessTitle")}
              description={messageTranslate("admin.projects.detail.projectAccessHelp").replace(/^[^:]+:\s*/, "")}
              htmlFor="project-access-required"
            >
              <input
                checked={state.projectAccessRequired.get()}
                class={authenticatedControlClasses.checkbox}
                disabled={!props.owned}
                id="project-access-required"
                onChange={(event) => state.projectAccessRequired.set(event.currentTarget.checked)}
                type="checkbox"
              />
            </AuthenticatedSettingsRow>
          </AuthenticatedSettingsList>

          <Show when={props.owned}>
            <div class="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-2">
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
    </div>
  )
}
