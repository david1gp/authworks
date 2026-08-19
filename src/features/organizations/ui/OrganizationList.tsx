import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { organizationListStateCreate } from "./organizationListStateCreate.js"

export function OrganizationList() {
  const state = organizationListStateCreate()
  return (
    <PageWrapper class="bg-transparent" innerClass="max-w-6xl">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-blue-600">Administration</p>
          <h1 class="text-3xl font-semibold tracking-tight">Organizations</h1>
          <p class="mt-1 text-muted-foreground">Manage the organizations in this realm.</p>
        </div>
        <CorvuDialog
          title="Create organization"
          description="Add an organization to the demo realm."
          variant="filledBlue"
          buttonChildren="Create organization"
          open={state.createOpen()}
          onOpenChange={state.createOpenSet}
        >
          <form class="grid gap-4" onSubmit={state.submit}>
            <div class="grid gap-2">
              <Label for="organization-name">Name</Label>
              <Input
                id="organization-name"
                value={state.name()}
                onInput={(event) => state.onName(event.currentTarget.value)}
              />
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
      <CardWrapper class="mt-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Label for="organization-search" class="sr-only">
            Search organizations
          </Label>
          <Input
            id="organization-search"
            class="max-w-sm"
            placeholder="Search by name or id"
            value={state.query()}
            onInput={(event) => state.searchSet(event.currentTarget.value)}
          />
          <span class="text-sm text-muted-foreground">{state.filteredOrganizations().length} organizations</span>
        </div>
        <Show
          when={state.filteredOrganizations().length > 0}
          fallback={<p class="py-8 text-center text-muted-foreground">No organizations found.</p>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredOrganizations()}>
                {(organization) => (
                  <TableRow class="cursor-pointer" onClick={() => state.openOrganization(organization.id)}>
                    <TableCell class="font-medium">{organization.name}</TableCell>
                    <TableCell class="font-mono text-xs">{organization.id}</TableCell>
                    <TableCell>
                      <Badge variant={state.badgeVariant(organization.status)}>{organization.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(organization.createdAt).toLocaleDateString()}</TableCell>
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
