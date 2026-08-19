import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { organizationDetailStateCreate } from "./organizationDetailStateCreate.js"

export function OrganizationDetail() {
  const state = organizationDetailStateCreate()
  return (
    <PageWrapper class="bg-transparent" innerClass="max-w-6xl">
      <Show when={state.organization()} fallback={<NotFound backHref={state.backHref} />}>
        {(organization) => (
          <>
            <A class="text-sm text-muted-foreground hover:underline" href={state.backHref}>
              ← Organizations
            </A>
            <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 class="text-3xl font-semibold tracking-tight">{organization().name}</h1>
                <p class="mt-1 font-mono text-xs text-muted-foreground">{organization().id}</p>
              </div>
              <Badge variant={state.statusVariant(organization().status as "active" | "inactive" | "removed")}>
                {organization().status}
              </Badge>
            </div>
            <CardWrapper class="mt-6">
              <dl class="grid gap-4 sm:grid-cols-3">
                <DetailItem label="Realm" value={organization().realmId} />
                <DetailItem label="Created" value={new Date(organization().createdAt).toLocaleString()} />
                <DetailItem label="Updated" value={new Date(organization().updatedAt).toLocaleString()} />
              </dl>
            </CardWrapper>
            <CardWrapper class="mt-6">
              <h2 class="text-xl font-semibold">Memberships</h2>
              <Show
                when={state.memberships.get().length > 0}
                fallback={<p class="py-6 text-muted-foreground">No memberships found.</p>}
              >
                <Table class="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Roles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <For each={state.memberships.get()}>
                      {(membership) => (
                        <TableRow>
                          <TableCell>{state.userName(membership.userId)}</TableCell>
                          <TableCell class="font-mono text-xs">{membership.userId}</TableCell>
                          <TableCell>{membership.roles.join(", ")}</TableCell>
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

function NotFound(props: { backHref: string }) {
  return (
    <div class="grid gap-3">
      <h1 class="text-2xl font-semibold">Organization not found</h1>
      <A class="text-blue-600 hover:underline" href={props.backHref}>
        Back to organizations
      </A>
    </div>
  )
}

function DetailItem(props: { label: string; value: string }) {
  return (
    <div>
      <dt class="text-sm text-muted-foreground">{props.label}</dt>
      <dd class="mt-1 break-all font-mono text-sm">{props.value}</dd>
    </div>
  )
}
