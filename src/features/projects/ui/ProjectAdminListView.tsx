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
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { projectAdminListViewStateCreate } from "./projectAdminListViewStateCreate.js"
import { projectAdminStatusTone } from "./projectAdminStatusTone.js"

export function ProjectAdminListView(props: { readonly state: ReturnType<typeof projectAdminListViewStateCreate> }) {
  const state = props.state
  return (
    <section aria-label={messageTranslate("admin.projects.list.title")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <AuthenticatedToolbar
        actions={
          <AuthenticatedDialog
            description={messageTranslate("admin.projects.list.description")}
            onOpenChange={state.createOpenSet}
            open={state.createOpen()}
            title={messageTranslate("admin.projects.list.create")}
            triggerLabel={messageTranslate("admin.projects.list.create")}
            variant="filledBlue"
          >
            <form class="grid gap-3" onSubmit={state.createSubmit}>
              <div class="grid gap-1">
                <Label for="project-name">{messageTranslate("admin.projects.list.name")}</Label>
                <Input
                  id="project-name"
                  onInput={(event) => state.name.set(event.currentTarget.value)}
                  value={state.name.get()}
                />
              </div>
              <div class="grid gap-1">
                <Label for="project-organization">{messageTranslate("admin.projects.detail.organization")}</Label>
                <SelectSingleNative
                  getOptions={() => state.page.organizations().map((organization) => organization.id)}
                  id="project-organization"
                  valueSignal={state.organizationId}
                  valueText={(id) => state.page.organizationName(id)}
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
        label={messageTranslate("admin.projects.list.title")}
      >
        <Label class="sr-only" for="project-search">
          {messageTranslate("admin.projects.list.search")}
        </Label>
        <Input
          class="max-w-xs"
          id="project-search"
          onInput={(event) => state.searchSet(event.currentTarget.value)}
          placeholder={messageTranslate("admin.projects.list.search")}
          value={state.search()}
        />
      </AuthenticatedToolbar>

      <ProjectAdminStateBoundary
        emptyDetail={messageTranslate("admin.projects.list.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <AuthenticatedSection>
          <AuthenticatedRecordList label={messageTranslate("admin.projects.list.title")}>
            <For each={state.filteredProjects()}>
              {(project) => (
                <AuthenticatedRecordItem
                  fields={[
                    {
                      label: messageTranslate("admin.projects.detail.organization"),
                      value: state.page.organizationName(project.organizationId),
                    },
                    {
                      label: messageTranslate("admin.projects.detail.updated"),
                      value: localeDateFormat(project.updatedAt, { dateStyle: "medium" }),
                    },
                  ]}
                  status={
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.projects.statusValue.${project.status}`)}
                      tone={projectAdminStatusTone(project.status)}
                    />
                  }
                  title={
                    <button
                      class="text-left font-medium text-accent hover:underline"
                      onClick={() => state.projectOpen(project.id)}
                      type="button"
                    >
                      {project.name}
                    </button>
                  }
                />
              )}
            </For>
          </AuthenticatedRecordList>

          <Table
            aria-label={messageTranslate("admin.projects.list.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.projects.list.name")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.projects.detail.organization")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.projects.status")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.projects.detail.updated")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredProjects()}>
                {(project) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <button
                        class="text-left font-medium text-accent hover:underline"
                        onClick={() => state.projectOpen(project.id)}
                        type="button"
                      >
                        {project.name}
                      </button>
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      {state.page.organizationName(project.organizationId)}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.projects.statusValue.${project.status}`)}
                        tone={projectAdminStatusTone(project.status)}
                      />
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      {localeDateFormat(project.updatedAt, { dateStyle: "medium" })}
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
