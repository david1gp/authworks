import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { Show } from "solid-js"
import { Checkbox } from "#ui/input/check/Checkbox.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { projectAdminDetailViewStateCreate } from "./projectAdminDetailViewStateCreate.js"
import { projectAdminStatusTone } from "./projectAdminStatusTone.js"

export function ProjectAdminDetailView(props: {
  readonly state: ReturnType<typeof projectAdminDetailViewStateCreate>
}) {
  const state = props.state
  return (
    <section aria-label={messageTranslate("admin.projects.detailTitle")} class="grid min-w-0 gap-5 [&>*]:min-w-0">
      <ProjectAdminStateBoundary
        emptyDetail={messageTranslate("admin.projects.list.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <Show when={state.page.project()}>
          {(project) => (
            <>
              <AuthenticatedSection
                actions={
                  <AuthenticatedStatus
                    label={messageTranslate(`admin.projects.statusValue.${project().status}`)}
                    tone={projectAdminStatusTone(project().status)}
                  />
                }
                padded
                title={project().name}
              >
                <AuthenticatedFieldList
                  columns={3}
                  fields={[
                    {
                      identifier: true,
                      label: messageTranslate("admin.projects.detail.identifier"),
                      value: project().id,
                    },
                    {
                      label: messageTranslate("admin.projects.detail.organization"),
                      value: state.page.organizationName(project().organizationId),
                    },
                    {
                      label: messageTranslate("admin.projects.detail.created"),
                      value: localeDateFormat(project().createdAt, { dateStyle: "medium", timeStyle: "short" }),
                    },
                    {
                      label: messageTranslate("admin.projects.detail.updated"),
                      value: localeDateFormat(project().updatedAt, { dateStyle: "medium", timeStyle: "short" }),
                    },
                  ]}
                />
              </AuthenticatedSection>

              <AuthenticatedSection
                description={messageTranslate("admin.projects.detail.settingsDescription")}
                title={messageTranslate("admin.projects.detail.settingsTitle")}
              >
                <form class="grid max-w-3xl gap-4 px-5 py-4" onSubmit={state.settingsSubmit}>
                  <div class="grid items-start gap-4 sm:grid-cols-2">
                    <div class="grid min-w-0 gap-1.5">
                      <Label class="text-[0.8125rem] font-medium" for="project-detail-name">
                        {messageTranslate("admin.projects.list.name")}
                      </Label>
                      <AuthenticatedInput
                        id="project-detail-name"
                        onInput={(event) => state.name.set(event.currentTarget.value)}
                        value={state.name.get()}
                      />
                    </div>
                    <div class="grid gap-1.5">
                      <Checkbox
                        class="text-[0.8125rem] font-medium"
                        checked={state.authorizationRequired.get()}
                        id="project-authorization-required"
                        onChange={state.authorizationRequired.set}
                      >
                        {messageTranslate("admin.projects.detail.authorizationRequired")}
                      </Checkbox>
                      <Checkbox
                        class="text-[0.8125rem] font-medium"
                        checked={state.projectAccessRequired.get()}
                        id="project-access-required"
                        onChange={state.projectAccessRequired.set}
                      >
                        {messageTranslate("admin.projects.detail.projectAccessRequired")}
                      </Checkbox>
                    </div>
                  </div>
                  <Show when={state.page.notice()}>
                    {(name) => (
                      <AuthenticatedNotice message={messageTranslate("admin.projects.saved", { name: name() })} />
                    )}
                  </Show>
                  <div class="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-4">
                    <AuthenticatedButton
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiContentSave}
                      type="submit"
                      variant="filledBlue"
                    >
                      {messageTranslate("common.save")}
                    </AuthenticatedButton>
                    <Show when={project().status === "active"}>
                      <AuthenticatedButton
                        size="sm"
                        disabled={state.page.pendingId() !== undefined}
                        icon={mdiCancel}
                        onClick={() => state.page.projectLifecycleSet(project().id, "inactive")}
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("admin.projects.lifecycle.deactivate")}
                      </AuthenticatedButton>
                    </Show>
                    <Show when={project().status === "inactive"}>
                      <AuthenticatedButton
                        size="sm"
                        disabled={state.page.pendingId() !== undefined}
                        icon={mdiCheckCircle}
                        onClick={() => state.page.projectLifecycleSet(project().id, "active")}
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("admin.projects.lifecycle.activate")}
                      </AuthenticatedButton>
                    </Show>
                    <AuthenticatedButton
                      size="sm"
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiDelete}
                      onClick={() => void state.projectDelete(project().id)}
                      type="button"
                      variant="outlineRed"
                    >
                      {messageTranslate("admin.projects.lifecycle.remove")}
                    </AuthenticatedButton>
                  </div>
                </form>
              </AuthenticatedSection>
            </>
          )}
        </Show>
      </ProjectAdminStateBoundary>
    </section>
  )
}
