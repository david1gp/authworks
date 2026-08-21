import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMembership } from "../public/organizationMembershipSchema.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import type { OrganizationRole } from "../public/organizationRoleSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminPagination } from "./OrganizationAdminPagination.js"
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
    <section class="grid gap-5">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">
          {messageTranslate("admin.organizations.memberships.title")}
        </h2>
        <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {messageTranslate("admin.organizations.memberships.description")}
        </p>
      </div>
      <OrganizationAdminNotice notice={props.notice} />
      <CardWrapper>
        <h3 class="text-lg font-semibold">{messageTranslate("admin.organizations.memberships.add")}</h3>
        <form class="mt-4 grid gap-4" onSubmit={props.onAddSubmit}>
          <div class="grid gap-2">
            <Label for="membership-user-id">{messageTranslate("admin.organizations.memberships.userId")}</Label>
            <Input
              class="max-w-md"
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
          <Show when={props.validationMessage}>
            {(message) => (
              <p class="text-sm text-danger" role="alert">
                {message()}
              </p>
            )}
          </Show>
          <div>
            <Button disabled={props.pendingId === "membership:create"} type="submit">
              {messageTranslate("admin.organizations.memberships.add")}
            </Button>
          </div>
        </form>
      </CardWrapper>
      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.memberships.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <CardWrapper>
          <p class="mb-4 text-sm text-muted-foreground">
            {messageTranslate("admin.organizations.memberships.rolesFixed")}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.organizations.memberships.userId")}</TableHead>
                <TableHead>{messageTranslate("admin.organizations.memberships.roles")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.memberships}>
                {(membership) => (
                  <TableRow>
                    <TableCell class="font-mono text-xs">{membership.userId}</TableCell>
                    <TableCell>
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
                    <TableCell>
                      <Button
                        disabled={props.pendingId === `membership:${membership.id}`}
                        onClick={() => props.onRemove(membership.id, membership.userId)}
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
          <OrganizationAdminPagination
            nextAvailable={props.nextPageAvailable}
            onNext={props.onNextPage}
            onPrevious={props.onPreviousPage}
            previousAvailable={props.previousPageAvailable}
          />
        </CardWrapper>
      </OrganizationAdminState>
    </section>
  )
}
