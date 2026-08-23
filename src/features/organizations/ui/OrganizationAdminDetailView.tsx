import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { Organization } from "../public/organizationSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import { organizationAdminStatusVariant } from "./organizationAdminStatusVariant.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

export function OrganizationAdminDetailView(props: {
  readonly backHref: string
  readonly error?: string
  readonly memberships: readonly OrganizationMembership[]
  readonly membershipsHref: string
  readonly name: string
  readonly notice?: string
  readonly onLifecycleSet: (status: "active" | "inactive" | "removed") => void
  readonly onNameInput: (value: string) => void
  readonly onRenameSubmit: (event: SubmitEvent) => void
  readonly onRetry: () => void
  readonly organization?: Organization
  readonly pendingId?: string
  readonly status: OrganizationAdminStatus
}) {
  return (
    <section class="grid gap-5">
      <A class="text-sm text-muted-foreground hover:underline" href={props.backHref}>
        ← {messageTranslate("admin.organizations.list.title")}
      </A>
      {/* The page heading stays outside the data boundary, so every fixture state has one h1. */}
      <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.organizations.detailTitle")}</h1>
      <OrganizationAdminNotice notice={props.notice} />
      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.list.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <Show when={props.organization}>
          {(organization) => (
            <div class="grid gap-5">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 class="break-words text-2xl font-semibold tracking-tight">{organization().name}</h2>
                  <p class="mt-1 font-mono text-xs text-muted-foreground">{organization().id}</p>
                </div>
                <Badge variant={organizationAdminStatusVariant(organization().status)}>{organization().status}</Badge>
              </div>
              <CardWrapper>
                <dl class="grid gap-4 sm:grid-cols-3">
                  <DetailItem
                    label={messageTranslate("admin.organizations.detail.realm")}
                    value={organization().realmId}
                  />
                  <DetailItem
                    label={messageTranslate("admin.organizations.detail.created")}
                    value={localeDateFormat(organization().createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  />
                  <DetailItem
                    label={messageTranslate("admin.organizations.detail.updated")}
                    value={localeDateFormat(organization().updatedAt, { dateStyle: "medium", timeStyle: "short" })}
                  />
                </dl>
              </CardWrapper>
              <CardWrapper>
                <h3 class="text-lg font-semibold">{messageTranslate("admin.organizations.detail.settingsTitle")}</h3>
                <p class="mt-1 text-sm text-muted-foreground">
                  {messageTranslate("admin.organizations.detail.settingsDescription")}
                </p>
                <form class="mt-4 flex flex-wrap items-end gap-3" onSubmit={props.onRenameSubmit}>
                  <div class="grid flex-1 gap-2">
                    <Label for="organization-detail-name">{messageTranslate("admin.organizations.list.name")}</Label>
                    <Input
                      id="organization-detail-name"
                      onInput={(event) => props.onNameInput(event.currentTarget.value)}
                      value={props.name}
                    />
                  </div>
                  <Button disabled={props.pendingId === "organization:rename"} type="submit">
                    {messageTranslate("common.save")}
                  </Button>
                </form>
                <div class="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
                  <Show when={organization().status !== "active"}>
                    <Button onClick={() => props.onLifecycleSet("active")} variant="outline">
                      {messageTranslate("admin.organizations.lifecycle.activate")}
                    </Button>
                  </Show>
                  <Show when={organization().status === "active"}>
                    <Button onClick={() => props.onLifecycleSet("inactive")} variant="outline">
                      {messageTranslate("admin.organizations.lifecycle.deactivate")}
                    </Button>
                  </Show>
                  <Show when={organization().status !== "removed"}>
                    <Button onClick={() => props.onLifecycleSet("removed")} variant="filledRed">
                      {messageTranslate("admin.organizations.lifecycle.remove")}
                    </Button>
                  </Show>
                </div>
              </CardWrapper>
              <CardWrapper>
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <h3 class="text-lg font-semibold">{messageTranslate("admin.organizations.memberships.title")}</h3>
                  <A class="text-sm text-accent hover:underline" href={props.membershipsHref}>
                    {messageTranslate("admin.organizations.memberships.title")}
                  </A>
                </div>
                <Show
                  when={props.memberships.length > 0}
                  fallback={
                    <p class="py-6 text-muted-foreground">
                      {messageTranslate("admin.organizations.memberships.empty")}
                    </p>
                  }
                >
                  <Table class="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{messageTranslate("admin.organizations.memberships.userId")}</TableHead>
                        <TableHead>{messageTranslate("admin.organizations.memberships.roles")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <For each={props.memberships}>
                        {(membership) => (
                          <TableRow>
                            <TableCell class="font-mono text-xs">{membership.userId}</TableCell>
                            <TableCell>{membership.roles.join(", ")}</TableCell>
                          </TableRow>
                        )}
                      </For>
                    </TableBody>
                  </Table>
                </Show>
              </CardWrapper>
            </div>
          )}
        </Show>
      </OrganizationAdminState>
    </section>
  )
}

function DetailItem(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt class="text-sm text-muted-foreground">{props.label}</dt>
      <dd class="mt-1 break-all font-mono text-sm">{props.value}</dd>
    </div>
  )
}
