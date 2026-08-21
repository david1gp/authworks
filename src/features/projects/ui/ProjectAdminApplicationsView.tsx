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
import type { projectAdminApplicationsViewStateCreate } from "./projectAdminApplicationsViewStateCreate.js"
import { projectStatusBadgeVariant } from "./projectStatusBadgeVariant.js"

export function ProjectAdminApplicationsView(props: {
  readonly state: ReturnType<typeof projectAdminApplicationsViewStateCreate>
}) {
  const state = props.state
  return (
    <section class="grid gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.projects.applications.title")}</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {messageTranslate("admin.projects.applications.description")}
          </p>
        </div>
        <CorvuDialog
          buttonChildren={messageTranslate("admin.projects.applications.create")}
          description={messageTranslate("admin.projects.applications.description")}
          onOpenChange={state.createOpenSet}
          open={state.createOpen()}
          title={messageTranslate("admin.projects.applications.create")}
          variant="filledBlue"
        >
          <form class="grid gap-4" onSubmit={state.createSubmit}>
            <div class="grid gap-2">
              <Label for="application-name">{messageTranslate("admin.projects.applications.name")}</Label>
              <Input
                id="application-name"
                onInput={(event) => state.name.set(event.currentTarget.value)}
                value={state.name.get()}
              />
            </div>
            <div class="grid gap-2">
              <Label for="application-type">{messageTranslate("admin.projects.applications.type")}</Label>
              <SelectSingleNative
                getOptions={() => ["oidc", "api", "saml"]}
                id="application-type"
                valueSignal={state.applicationType}
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
        emptyDetail={messageTranslate("admin.projects.applications.empty")}
        error={state.page.error()}
        onRetry={state.page.reload}
        status={state.page.status()}
      >
        <CardWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.projects.applications.name")}</TableHead>
                <TableHead>{messageTranslate("admin.projects.applications.type")}</TableHead>
                <TableHead>{messageTranslate("admin.projects.status")}</TableHead>
                <TableHead class="text-right">{messageTranslate("common.save")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.page.applications()}>
                {(application) => (
                  <TableRow>
                    <TableCell class="font-medium">{application.name}</TableCell>
                    <TableCell class="uppercase">{application.applicationType}</TableCell>
                    <TableCell>
                      <Badge variant={projectStatusBadgeVariant(application.status)}>{application.status}</Badge>
                    </TableCell>
                    <TableCell class="text-right">
                      <div class="flex justify-end gap-2">
                        <Show when={application.status === "active"}>
                          <Button
                            disabled={state.page.pendingId() !== undefined}
                            onClick={() => state.lifecycleSet(application.id, "inactive")}
                            variant="outline"
                          >
                            {messageTranslate("admin.projects.lifecycle.deactivate")}
                          </Button>
                        </Show>
                        <Show when={application.status === "inactive"}>
                          <Button
                            disabled={state.page.pendingId() !== undefined}
                            onClick={() => state.lifecycleSet(application.id, "active")}
                            variant="outline"
                          >
                            {messageTranslate("admin.projects.lifecycle.activate")}
                          </Button>
                        </Show>
                        <Button
                          disabled={state.page.pendingId() !== undefined}
                          onClick={() => state.lifecycleSet(application.id, "removed")}
                          variant="filledRed"
                        >
                          {messageTranslate("admin.projects.lifecycle.remove")}
                        </Button>
                      </div>
                    </TableCell>
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
