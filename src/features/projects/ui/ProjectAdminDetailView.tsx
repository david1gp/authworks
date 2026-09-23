import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { Show } from "solid-js"
import { Checkbox } from "#ui/input/check/Checkbox.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
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
    <section aria-label={messageTranslate("admin.projects.detailTitle")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
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
                <form class="grid gap-3 px-3 py-3" onSubmit={state.settingsSubmit}>
                  <div class="grid items-end gap-3 sm:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
                    <div class="grid min-w-0 gap-1">
                      <Label for="project-detail-name">{messageTranslate("admin.projects.list.name")}</Label>
                      <Input
                        id="project-detail-name"
                        onInput={(event) => state.name.set(event.currentTarget.value)}
                        value={state.name.get()}
                      />
                    </div>
                    <div class="grid gap-1.5">
                      <Checkbox
                        checked={state.authorizationRequired.get()}
                        id="project-authorization-required"
                        onChange={state.authorizationRequired.set}
                      >
                        {messageTranslate("admin.projects.detail.authorizationRequired")}
                      </Checkbox>
                      <Checkbox
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
                  <div class="flex flex-wrap gap-2 border-t border-line-subtle pt-3">
                    <ButtonIcon
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiContentSave}
                      type="submit"
                      variant="filledBlue"
                    >
                      {messageTranslate("common.save")}
                    </ButtonIcon>
                    <Show when={project().status === "active"}>
                      <ButtonIcon
                        disabled={state.page.pendingId() !== undefined}
                        icon={mdiCancel}
                        onClick={() => state.page.projectLifecycleSet(project().id, "inactive")}
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("admin.projects.lifecycle.deactivate")}
                      </ButtonIcon>
                    </Show>
                    <Show when={project().status === "inactive"}>
                      <ButtonIcon
                        disabled={state.page.pendingId() !== undefined}
                        icon={mdiCheckCircle}
                        onClick={() => state.page.projectLifecycleSet(project().id, "active")}
                        type="button"
                        variant="outline"
                      >
                        {messageTranslate("admin.projects.lifecycle.activate")}
                      </ButtonIcon>
                    </Show>
                    <ButtonIcon
                      disabled={state.page.pendingId() !== undefined}
                      icon={mdiDelete}
                      onClick={() => void state.projectDelete(project().id)}
                      type="button"
                      variant="filledRed"
                    >
                      {messageTranslate("admin.projects.lifecycle.remove")}
                    </ButtonIcon>
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
