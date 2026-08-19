import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Fieldset } from "#ui/input/fieldset/Fieldset.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { projectListStateCreate } from "./projectListStateCreate.js"

export function ProjectList() {
  const state = projectListStateCreate()
  return (
    <PageWrapper class="bg-transparent" innerClass="max-w-6xl">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-blue-600">Administration</p>
          <h1 class="text-3xl font-semibold tracking-tight">Projects</h1>
          <p class="mt-1 text-muted-foreground">Manage projects and their authorization roles.</p>
        </div>
        <CorvuDialog
          title="Create project"
          description="Add a project to an organization."
          variant="filledBlue"
          buttonChildren="Create project"
          open={state.createOpen()}
          onOpenChange={state.createOpenSet}
        >
          <form class="grid gap-4" onSubmit={state.submit}>
            <div class="grid gap-2">
              <Label for="project-name">Name</Label>
              <Input
                id="project-name"
                value={state.name()}
                onInput={(event) => state.onName(event.currentTarget.value)}
              />
            </div>
            <Fieldset title="Organization" class="grid gap-2">
              <SelectSingleNative
                id="project-organization"
                valueSignal={state.organizationId}
                getOptions={() => state.organizations.map((organization) => organization.id)}
                valueText={(id) => state.organizationName(id)}
              />
            </Fieldset>
            <Show when={state.error()}>
              <p class="text-sm text-red-600">{state.error()}</p>
            </Show>
            <Button type="submit" variant="filledBlue">
              Create
            </Button>
          </form>
        </CorvuDialog>
      </div>
      <CardWrapper class="mt-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Label for="project-search" class="sr-only">
            Search projects
          </Label>
          <Input
            id="project-search"
            class="max-w-sm"
            placeholder="Search by name or id"
            value={state.query()}
            onInput={(event) => state.searchSet(event.currentTarget.value)}
          />
          <span class="text-sm text-muted-foreground">{state.filteredProjects().length} projects</span>
        </div>
        <Show
          when={state.filteredProjects().length > 0}
          fallback={<p class="py-8 text-center text-muted-foreground">No projects found.</p>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredProjects()}>
                {(project) => (
                  <TableRow class="cursor-pointer" onClick={() => state.openProject(project.id)}>
                    <TableCell class="font-medium">{project.name}</TableCell>
                    <TableCell>{state.organizationName(project.organizationId)}</TableCell>
                    <TableCell class="font-mono text-xs">{project.id}</TableCell>
                    <TableCell>
                      <Badge variant={state.badgeVariant(project.status)}>{project.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(project.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </Show>
      </CardWrapper>
    </PageWrapper>
  )
}
