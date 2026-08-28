import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { Organization } from "../public/organizationSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import { organizationAdminStatusTone } from "./organizationAdminStatusTone.js"
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
    <section aria-label={messageTranslate("admin.organizations.detailTitle")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <A class="text-xs font-medium text-accent hover:underline" href={props.backHref}>
        {messageTranslate("admin.organizations.list.title")}
      </A>

      <OrganizationAdminNotice notice={props.notice} />

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.list.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <Show when={props.organization}>
          {(organization) => (
            <>
              <AuthenticatedSection
                actions={
                  <AuthenticatedStatus
                    label={messageTranslate(`admin.organizations.statusValue.${organization().status}`)}
                    tone={organizationAdminStatusTone(organization().status)}
                  />
                }
                padded
                title={organization().name}
              >
                <AuthenticatedFieldList
                  columns={3}
                  fields={[
                    {
                      identifier: true,
                      label: messageTranslate("admin.organizations.detail.realm"),
                      value: organization().realmId,
                    },
                    {
                      label: messageTranslate("admin.organizations.detail.created"),
                      value: localeDateFormat(organization().createdAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    },
                    {
                      label: messageTranslate("admin.organizations.detail.updated"),
                      value: localeDateFormat(organization().updatedAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    },
                  ]}
                />
              </AuthenticatedSection>

              <AuthenticatedSection
                description={messageTranslate("admin.organizations.detail.settingsDescription")}
                title={messageTranslate("admin.organizations.detail.settingsTitle")}
              >
                <form class="grid gap-3 px-3 py-3" onSubmit={props.onRenameSubmit}>
                  <div class="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div class="grid min-w-0 gap-1">
                      <Label for="organization-detail-name">{messageTranslate("admin.organizations.list.name")}</Label>
                      <Input
                        id="organization-detail-name"
                        onInput={(event) => props.onNameInput(event.currentTarget.value)}
                        value={props.name}
                      />
                    </div>
                    <Button disabled={props.pendingId !== undefined} size="sm" type="submit">
                      {messageTranslate("common.save")}
                    </Button>
                  </div>
                  <div class="flex flex-wrap gap-2 border-t border-line-subtle pt-3">
                    <Show when={organization().status !== "active"}>
                      <Button
                        disabled={props.pendingId !== undefined}
                        onClick={() => props.onLifecycleSet("active")}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("admin.organizations.lifecycle.activate")}
                      </Button>
                    </Show>
                    <Show when={organization().status === "active"}>
                      <Button
                        disabled={props.pendingId !== undefined}
                        onClick={() => props.onLifecycleSet("inactive")}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("admin.organizations.lifecycle.deactivate")}
                      </Button>
                    </Show>
                    <Show when={organization().status !== "removed"}>
                      <Button
                        disabled={props.pendingId !== undefined}
                        onClick={() => props.onLifecycleSet("removed")}
                        size="sm"
                        variant="filledRed"
                      >
                        {messageTranslate("admin.organizations.lifecycle.remove")}
                      </Button>
                    </Show>
                  </div>
                </form>
              </AuthenticatedSection>

              <AuthenticatedSection
                actions={
                  <A class="text-xs font-medium text-accent hover:underline" href={props.membershipsHref}>
                    {messageTranslate("admin.organizations.memberships.title")}
                  </A>
                }
                title={messageTranslate("admin.organizations.memberships.title")}
              >
                <Show
                  when={props.memberships.length > 0}
                  fallback={
                    <ProductionStatePanel
                      compact
                      detail={messageTranslate("admin.organizations.memberships.empty")}
                      state="empty"
                    />
                  }
                >
                  <AuthenticatedRecordList label={messageTranslate("admin.organizations.memberships.title")}>
                    <For each={props.memberships}>
                      {(membership) => (
                        <AuthenticatedRecordItem
                          fields={[
                            {
                              label: messageTranslate("admin.organizations.memberships.roles"),
                              value: membership.roles.join(", "),
                              wide: true,
                            },
                          ]}
                          title={<span class="font-mono text-xs">{membership.userId}</span>}
                        />
                      )}
                    </For>
                  </AuthenticatedRecordList>

                  <Table
                    aria-label={messageTranslate("admin.organizations.memberships.title")}
                    class={authenticatedTableClasses.tableWide}
                    tabIndex={0}
                  >
                    <TableHeader class={authenticatedTableClasses.header}>
                      <TableRow>
                        <TableHead class={authenticatedTableClasses.head}>
                          {messageTranslate("admin.organizations.memberships.userId")}
                        </TableHead>
                        <TableHead class={authenticatedTableClasses.head}>
                          {messageTranslate("admin.organizations.memberships.roles")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <For each={props.memberships}>
                        {(membership) => (
                          <TableRow class={authenticatedTableClasses.row}>
                            <TableCell class={authenticatedTableClasses.identifier}>{membership.userId}</TableCell>
                            <TableCell class={authenticatedTableClasses.cell}>{membership.roles.join(", ")}</TableCell>
                          </TableRow>
                        )}
                      </For>
                    </TableBody>
                  </Table>
                </Show>
              </AuthenticatedSection>
            </>
          )}
        </Show>
      </OrganizationAdminState>
    </section>
  )
}
