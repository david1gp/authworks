import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { AuthenticatedToolbar } from "../../../ui/authenticated/AuthenticatedToolbar.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import { ProjectAdminProjectContext } from "./ProjectAdminProjectContext.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { projectAdminApplicationsViewStateCreate } from "./projectAdminApplicationsViewStateCreate.js"
import { projectAdminStatusTone } from "./projectAdminStatusTone.js"

export function ProjectAdminApplicationsView(props: {
  readonly state: ReturnType<typeof projectAdminApplicationsViewStateCreate>
}) {
  const state = props.state
  const lifecycleActions = (application: ProjectApplication) => (
    <>
      <Show when={application.status === "active"}>
        <Button
          disabled={state.page.pendingId() !== undefined}
          onClick={() => state.lifecycleSet(application.id, "inactive")}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.projects.lifecycle.deactivate")}
        </Button>
      </Show>
      <Show when={application.status === "inactive"}>
        <Button
          disabled={state.page.pendingId() !== undefined}
          onClick={() => state.lifecycleSet(application.id, "active")}
          size="sm"
          variant="outline"
        >
          {messageTranslate("admin.projects.lifecycle.activate")}
        </Button>
      </Show>
      <Button
        disabled={state.page.pendingId() !== undefined}
        onClick={() => state.lifecycleSet(application.id, "removed")}
        size="sm"
        variant="filledRed"
      >
        {messageTranslate("admin.projects.lifecycle.remove")}
      </Button>
    </>
  )

  return (
    <section
      aria-label={messageTranslate("admin.projects.applications.title")}
      class="grid min-w-0 gap-3 [&>*]:min-w-0"
    >
      <ProjectAdminProjectContext page={state.page} />

      <AuthenticatedToolbar
        actions={
          <AuthenticatedDialog
            description={messageTranslate("admin.projects.applications.description")}
            onOpenChange={state.createOpenSet}
            open={state.createOpen()}
            title={messageTranslate("admin.projects.applications.create")}
            triggerLabel={messageTranslate("admin.projects.applications.create")}
            variant="filledBlue"
          >
            <form class="grid gap-3" onSubmit={state.createSubmit}>
              <div class="grid gap-1">
                <Label for="application-name">{messageTranslate("admin.projects.applications.name")}</Label>
                <Input
                  id="application-name"
                  onInput={(event) => state.name.set(event.currentTarget.value)}
                  value={state.name.get()}
                />
              </div>
              <div class="grid gap-1">
                <Label for="application-type">{messageTranslate("admin.projects.applications.type")}</Label>
                <SelectSingleNative
                  getOptions={() => ["oidc", "api", "saml"]}
                  id="application-type"
                  valueSignal={state.applicationType}
                />
              </div>
              <Show when={state.formError()}>
                {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
              </Show>
              <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
                {messageTranslate("common.save")}
              </Button>
            </form>
          </AuthenticatedDialog>
        }
        label={messageTranslate("admin.projects.applications.title")}
        summary={messageTranslate("admin.projects.applications.description")}
      />

      <ProjectAdminStateBoundary
        emptyDetail={messageTranslate("admin.projects.applications.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <AuthenticatedSection>
          <AuthenticatedRecordList label={messageTranslate("admin.projects.applications.title")}>
            <For each={state.page.applications()}>
              {(application) => (
                <AuthenticatedRecordItem
                  actions={lifecycleActions(application)}
                  fields={[
                    {
                      label: messageTranslate("admin.projects.applications.type"),
                      value: <span class="uppercase">{application.applicationType}</span>,
                    },
                  ]}
                  status={
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.projects.statusValue.${application.status}`)}
                      tone={projectAdminStatusTone(application.status)}
                    />
                  }
                  title={application.name}
                />
              )}
            </For>
          </AuthenticatedRecordList>

          <Table
            aria-label={messageTranslate("admin.projects.applications.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.projects.applications.name")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.projects.applications.type")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.projects.status")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  <span class="sr-only">{messageTranslate("admin.projects.lifecycle.remove")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.page.applications()}>
                {(application) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>{application.name}</TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} uppercase`}>
                      {application.applicationType}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.projects.statusValue.${application.status}`)}
                        tone={projectAdminStatusTone(application.status)}
                      />
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.action}>
                      <div class="flex flex-nowrap justify-end gap-1.5">{lifecycleActions(application)}</div>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>

          <AuthenticatedPagination
            nextAvailable={state.page.hasNextPage()}
            onNext={state.page.pageNext}
            onPrevious={state.page.pagePrevious}
            previousAvailable={state.page.hasPreviousPage()}
          />
        </AuthenticatedSection>
      </ProjectAdminStateBoundary>
    </section>
  )
}
