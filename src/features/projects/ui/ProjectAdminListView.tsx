import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProjectAdminPagination } from "./ProjectAdminPagination.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { projectAdminListViewStateCreate } from "./projectAdminListViewStateCreate.js"
import { projectStatusBadgeVariant } from "./projectStatusBadgeVariant.js"

export function ProjectAdminListView(props: { readonly state: ReturnType<typeof projectAdminListViewStateCreate> }) {
  const state = props.state
  return (
    <section class="grid gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.projects.list.title")}</h2>
          <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("admin.projects.list.description")}</p>
        </div>
        <CorvuDialog
          buttonChildren={messageTranslate("admin.projects.list.create")}
          description={messageTranslate("admin.projects.list.description")}
          onOpenChange={state.createOpenSet}
          open={state.createOpen()}
          title={messageTranslate("admin.projects.list.create")}
          variant="filledBlue"
        >
          <form class="grid gap-4" onSubmit={state.createSubmit}>
            <div class="grid gap-2">
              <Label for="project-name">{messageTranslate("admin.projects.list.name")}</Label>
              <Input
                id="project-name"
                onInput={(event) => state.name.set(event.currentTarget.value)}
                value={state.name.get()}
              />
            </div>
            <div class="grid gap-2">
              <Label for="project-organization">{messageTranslate("admin.projects.detail.organization")}</Label>
              <SelectSingleNative
                getOptions={() => state.page.organizations().map((organization) => organization.id)}
                id="project-organization"
                valueSignal={state.organizationId}
                valueText={(id) => state.page.organizationName(id)}
              />
            </div>
            <Show when={state.formError()}>
              {(message) => (
                <p class="text-sm text-danger" role="alert">
                  {message()}
                </p>
              )}
            </Show>
            <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
              {messageTranslate("common.save")}
            </Button>
          </form>
        </CorvuDialog>
      </div>

      <ProjectAdminStateBoundary
        emptyDetail={messageTranslate("admin.projects.list.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <CardWrapper>
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Label class="sr-only" for="project-search">
              {messageTranslate("admin.projects.list.search")}
            </Label>
            <Input
              class="max-w-sm"
              id="project-search"
              onInput={(event) => state.searchSet(event.currentTarget.value)}
              placeholder={messageTranslate("admin.projects.list.search")}
              value={state.search()}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.projects.list.name")}</TableHead>
                <TableHead>{messageTranslate("admin.projects.detail.organization")}</TableHead>
                <TableHead>{messageTranslate("admin.projects.status")}</TableHead>
                <TableHead>{messageTranslate("admin.projects.detail.updated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredProjects()}>
                {(project) => (
                  <TableRow class="cursor-pointer" onClick={() => state.projectOpen(project.id)}>
                    <TableCell class="font-medium">{project.name}</TableCell>
                    <TableCell>{state.page.organizationName(project.organizationId)}</TableCell>
                    <TableCell>
                      <Badge variant={projectStatusBadgeVariant(project.status)}>{project.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(project.updatedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
          <ProjectAdminPagination
            hasNext={state.page.hasNextPage()}
            hasPrevious={state.page.hasPreviousPage()}
            onNext={state.page.pageNext}
            onPrevious={state.page.pagePrevious}
          />
        </CardWrapper>
      </ProjectAdminStateBoundary>
    </section>
  )
}
