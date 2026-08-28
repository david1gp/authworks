import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import type { OrganizationRole } from "../public/organizationRoleSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminRoleChooser } from "./OrganizationAdminRoleChooser.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

export function OrganizationAdminMembershipsView(props: {
  readonly addRoles: readonly OrganizationRoleId[]
  readonly addUserId: string
  readonly error?: string
  readonly memberships: readonly OrganizationMembership[]
  readonly nextPageAvailable: boolean
  readonly notice?: string
  readonly onAddRoleToggle: (role: OrganizationRoleId) => void
  readonly onAddSubmit: (event: SubmitEvent) => void
  readonly onAddUserIdInput: (value: string) => void
  readonly onNextPage: () => void
  readonly onPreviousPage: () => void
  readonly onRemove: (membershipId: string, userId: string) => void
  readonly onRetry: () => void
  readonly onRoleToggle: (membership: OrganizationMembership, role: OrganizationRoleId) => void
  readonly pendingId?: string
  readonly previousPageAvailable: boolean
  readonly roles: readonly OrganizationRole[]
  readonly status: OrganizationAdminStatus
  readonly validationMessage?: string
}) {
  return (
    <AuthenticatedPageBody>
      <OrganizationAdminNotice notice={props.notice} />

      <AuthenticatedSection
        description={messageTranslate("admin.organizations.memberships.description")}
        title={messageTranslate("admin.organizations.memberships.add")}
      >
        <form class="grid gap-3 px-3 py-3" onSubmit={props.onAddSubmit}>
          <div class="grid items-end gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_auto]">
            <div class="grid min-w-0 gap-1">
              <Label for="membership-user-id">{messageTranslate("admin.organizations.memberships.userId")}</Label>
              <Input
                id="membership-user-id"
                onInput={(event) => props.onAddUserIdInput(event.currentTarget.value)}
                value={props.addUserId}
              />
            </div>
            <OrganizationAdminRoleChooser
              idPrefix="membership-add"
              legend={messageTranslate("admin.organizations.memberships.roles")}
              onToggle={props.onAddRoleToggle}
              roles={props.roles}
              selected={props.addRoles}
            />
            <Button disabled={props.pendingId === "membership:create"} size="sm" type="submit">
              {messageTranslate("admin.organizations.memberships.add")}
            </Button>
          </div>
          <Show when={props.validationMessage}>
            {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
          </Show>
        </form>
      </AuthenticatedSection>

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.memberships.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <AuthenticatedSection
          description={messageTranslate("admin.organizations.memberships.rolesFixed")}
          title={messageTranslate("admin.organizations.memberships.title")}
        >
          <AuthenticatedRecordList label={messageTranslate("admin.organizations.memberships.title")}>
            <For each={props.memberships}>
              {(membership) => (
                <AuthenticatedRecordItem
                  actions={
                    <Button
                      disabled={props.pendingId === `membership:${membership.id}`}
                      onClick={() => props.onRemove(membership.id, membership.userId)}
                      size="sm"
                      variant="outline"
                    >
                      {messageTranslate("admin.organizations.memberships.remove")}
                    </Button>
                  }
                  fields={[]}
                  title={<span class="font-mono text-xs">{membership.userId}</span>}
                >
                  <OrganizationAdminRoleChooser
                    disabled={props.pendingId === `membership:${membership.id}`}
                    idPrefix={`membership-record-${membership.id}`}
                    legend={messageTranslate("admin.organizations.memberships.roles")}
                    legendHidden
                    onToggle={(role) => props.onRoleToggle(membership, role)}
                    roles={props.roles}
                    selected={membership.roles}
                  />
                </AuthenticatedRecordItem>
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
                <TableHead class={authenticatedTableClasses.head}>
                  <span class="sr-only">{messageTranslate("admin.organizations.memberships.remove")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.memberships}>
                {(membership) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={authenticatedTableClasses.identifier}>{membership.userId}</TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <OrganizationAdminRoleChooser
                        disabled={props.pendingId === `membership:${membership.id}`}
                        idPrefix={`membership-${membership.id}`}
                        legend={messageTranslate("admin.organizations.memberships.roles")}
                        legendHidden
                        onToggle={(role) => props.onRoleToggle(membership, role)}
                        roles={props.roles}
                        selected={membership.roles}
                      />
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.action}>
                      <Button
                        disabled={props.pendingId === `membership:${membership.id}`}
                        onClick={() => props.onRemove(membership.id, membership.userId)}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("admin.organizations.memberships.remove")}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>

          <AuthenticatedPagination
            nextAvailable={props.nextPageAvailable}
            onNext={props.onNextPage}
            onPrevious={props.onPreviousPage}
            previousAvailable={props.previousPageAvailable}
          />
        </AuthenticatedSection>
      </OrganizationAdminState>
    </AuthenticatedPageBody>
  )
}
