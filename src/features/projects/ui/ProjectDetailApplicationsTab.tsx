import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiCheckCircle } from "@adaptive-ds/mdi/mdiCheckCircle.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDelete } from "@adaptive-ds/mdi/mdiDelete.js"
import { mdiPlus } from "@adaptive-ds/mdi/mdiPlus.js"
import { Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDataTable } from "../../../ui/authenticated/AuthenticatedDataTable.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedEmptyState } from "../../../ui/authenticated/AuthenticatedEmptyState.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import type { AuthenticatedDataTableColumn } from "../../../ui/authenticated/authenticatedDataTableColumn.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import type { projectAdminApplicationsTabStateCreate } from "./projectAdminApplicationsTabStateCreate.js"
import { projectAdminStatusTone } from "./projectAdminStatusTone.js"

/** Applications tab: project applications with create dialog and lifecycle actions. */
export function ProjectDetailApplicationsTab(props: {
  readonly owned: boolean
  readonly state: ReturnType<typeof projectAdminApplicationsTabStateCreate>
}) {
  const state = props.state
  const lifecycleActions = (application: ProjectApplication) => (
    <>
      <Show when={application.status === "active"}>
        <AuthenticatedButton
          disabled={state.page.pendingId() !== undefined}
          icon={mdiCancel}
          onClick={() => state.lifecycleSet(application.id, "inactive")}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.projects.lifecycle.deactivate")}
        </AuthenticatedButton>
      </Show>
      <Show when={application.status === "inactive"}>
        <AuthenticatedButton
          disabled={state.page.pendingId() !== undefined}
          icon={mdiCheckCircle}
          onClick={() => state.lifecycleSet(application.id, "active")}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.projects.lifecycle.activate")}
        </AuthenticatedButton>
      </Show>
      <AuthenticatedButton
        disabled={state.page.pendingId() !== undefined}
        icon={mdiDelete}
        onClick={() => state.lifecycleSet(application.id, "removed")}
        size="sm"
        variant="outlineRed"
      >
        {messageTranslate("admin.projects.lifecycle.remove")}
      </AuthenticatedButton>
    </>
  )
  const columns: AuthenticatedDataTableColumn<ProjectApplication>[] = [
    {
      cell: (application) => <span class="font-medium">{application.name}</span>,
      header: messageTranslate("admin.projects.applications.name"),
      key: "name",
    },
    {
      cell: (application) => <AuthenticatedChip label={application.applicationType.toUpperCase()} tone="neutral" />,
      header: messageTranslate("admin.projects.applications.type"),
      key: "type",
    },
    {
      cell: (application) => (
        <AuthenticatedStatus
          label={messageTranslate(`admin.projects.statusValue.${application.status}`)}
          tone={projectAdminStatusTone(application.status)}
        />
      ),
      header: messageTranslate("admin.projects.status"),
      key: "status",
    },
  ]
  const ownedColumns: AuthenticatedDataTableColumn<ProjectApplication>[] = [
    ...columns,
    {
      align: "end",
      cell: (application) => <div class="flex flex-nowrap justify-end gap-1.5">{lifecycleActions(application)}</div>,
      header: messageTranslate("admin.projects.lifecycle.remove"),
      key: "actions",
    },
  ]

  return (
    <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
      <AuthenticatedSection
        actions={
          <Show when={props.owned}>
            <AuthenticatedDialog
              description={messageTranslate("admin.projects.applications.description")}
              onOpenChange={state.createOpenSet}
              open={state.createOpen()}
              title={messageTranslate("admin.projects.applications.create")}
              triggerIcon={mdiPlus}
              triggerLabel={messageTranslate("admin.projects.applications.create")}
              variant="filledBlue"
            >
              <form class="grid gap-4" onSubmit={(event) => void state.createSubmit(event)}>
                <div class="grid gap-1.5">
                  <Label class="text-[0.8125rem] font-medium" for="application-name">
                    {messageTranslate("admin.projects.applications.name")}
                  </Label>
                  <AuthenticatedInput
                    id="application-name"
                    onInput={(event) => state.name.set(event.currentTarget.value)}
                    value={state.name.get()}
                  />
                </div>
                <div class="grid gap-1.5">
                  <Label class="text-[0.8125rem] font-medium" for="application-type">
                    {messageTranslate("admin.projects.applications.type")}
                  </Label>
                  <AuthenticatedSelect
                    getOptions={() => ["oidc", "api", "saml"]}
                    id="application-type"
                    valueSignal={state.applicationType}
                  />
                </div>
                <Show when={state.formError()}>
                  {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                </Show>
                <div class="flex justify-end gap-2">
                  <AuthenticatedButton
                    disabled={state.page.pendingId() !== undefined}
                    icon={mdiContentSave}
                    type="submit"
                    variant="filledBlue"
                  >
                    {messageTranslate("common.save")}
                  </AuthenticatedButton>
                </div>
              </form>
            </AuthenticatedDialog>
          </Show>
        }
        description={messageTranslate("admin.projects.applications.description")}
        title={messageTranslate("admin.projects.applications.title")}
      >
        <Show
          when={state.page.applications().length > 0}
          fallback={
            <AuthenticatedEmptyState
              actions={
                <Show when={props.owned}>
                  <AuthenticatedButton icon={mdiPlus} onClick={() => state.createOpenSet(true)} variant="filledBlue">
                    {messageTranslate("admin.projects.applications.create")}
                  </AuthenticatedButton>
                </Show>
              }
              description={messageTranslate("admin.projects.applications.empty")}
              title={messageTranslate("admin.projects.applications.title")}
            />
          }
        >
          <AuthenticatedDataTable
            caption={messageTranslate("admin.projects.applications.title")}
            columns={props.owned ? ownedColumns : columns}
            rowKey={(application) => application.id}
            rows={state.page.applications()}
          />
        </Show>
      </AuthenticatedSection>
    </div>
  )
}
