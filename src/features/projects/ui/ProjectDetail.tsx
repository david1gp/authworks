import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { projectDetailStateCreate } from "./projectDetailStateCreate.js"

export function ProjectDetail() {
  const state = projectDetailStateCreate()
  return (
    <PageWrapper class="bg-transparent" innerClass="max-w-6xl">
      <Show when={state.project()} fallback={<NotFound />}>
        {(project) => (
          <>
            <A class="text-sm text-muted-foreground hover:underline" href="/demo/admin/projects">
              ← Projects
            </A>
            <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 class="text-3xl font-semibold tracking-tight">{project().name}</h1>
                <p class="mt-1 font-mono text-xs text-muted-foreground">{project().id}</p>
              </div>
              <Badge variant={state.statusVariant(project().status as "active" | "inactive" | "removed")}>
                {project().status}
              </Badge>
            </div>
            <CardWrapper class="mt-6">
              <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Organization" value={state.organizationName(project().organizationId)} />
                <DetailItem label="Organization ID" value={project().organizationId} />
                <DetailItem label="Authorization required" value={project().authorizationRequired ? "Yes" : "No"} />
                <DetailItem label="Project access required" value={project().projectAccessRequired ? "Yes" : "No"} />
                <DetailItem label="Created" value={new Date(project().createdAt).toLocaleString()} />
                <DetailItem label="Updated" value={new Date(project().updatedAt).toLocaleString()} />
              </dl>
            </CardWrapper>
            <CardWrapper class="mt-6">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="text-xl font-semibold">Roles</h2>
                <CorvuDialog
                  title="Create role"
                  description="Add a role to this project."
                  variant="filledBlue"
                  buttonChildren="Create role"
                  open={state.createOpen()}
                  onOpenChange={state.createOpenSet}
                >
                  <form class="grid gap-4" onSubmit={state.submit}>
                    <div class="grid gap-4">
                      <div class="grid gap-2">
                        <Label for="role-key">Key</Label>
                        <Input
                          id="role-key"
                          value={state.key()}
                          onInput={(event) => state.onKey(event.currentTarget.value)}
                        />
                      </div>
                      <div class="grid gap-2">
                        <Label for="role-display-name">Display name</Label>
                        <Input
                          id="role-display-name"
                          value={state.displayName()}
                          onInput={(event) => state.onDisplayName(event.currentTarget.value)}
                        />
                      </div>
                      <div class="grid gap-2">
                        <Label for="role-group">Group (optional)</Label>
                        <Input
                          id="role-group"
                          value={state.group()}
                          onInput={(event) => state.onGroup(event.currentTarget.value)}
                        />
                      </div>
                    </div>
                    <Show when={state.error()}>
                      <p class="text-sm text-red-600">{state.error()}</p>
                    </Show>
                    <Button type="submit" variant="filledBlue">
                      Create
                    </Button>
                  </form>
                </CorvuDialog>
              </div>
              <Show
                when={state.roles.get().length > 0}
                fallback={<p class="py-6 text-muted-foreground">No roles found.</p>}
              >
                <Table class="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Display name</TableHead>
                      <TableHead>Group</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <For each={state.roles.get()}>
                      {(role) => (
                        <TableRow>
                          <TableCell class="font-mono">{role.key}</TableCell>
                          <TableCell>{role.displayName}</TableCell>
                          <TableCell>{role.group ?? "—"}</TableCell>
                        </TableRow>
                      )}
                    </For>
                  </TableBody>
                </Table>
              </Show>
            </CardWrapper>
          </>
        )}
      </Show>
    </PageWrapper>
  )
}

function NotFound() {
  return (
    <div class="grid gap-3">
      <h1 class="text-2xl font-semibold">Project not found</h1>
      <A class="text-blue-600 hover:underline" href="/demo/admin/projects">
        Back to projects
      </A>
    </div>
  )
}
function DetailItem(props: { label: string; value: string }) {
  return (
    <div>
      <dt class="text-sm text-muted-foreground">{props.label}</dt>
      <dd class="mt-1 break-all text-sm">{props.value}</dd>
    </div>
  )
}
