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
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedTableClasses } from "../../../ui/authenticated/authenticatedTableClasses.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationInvitation } from "../public/organizationInvitationSchema.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import type { OrganizationRole } from "../public/organizationRoleSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminRoleChooser } from "./OrganizationAdminRoleChooser.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import { organizationAdminInvitationStatusTone } from "./organizationAdminInvitationStatusTone.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

export function OrganizationAdminInvitationsView(props: {
  readonly email: string
  readonly error?: string
  readonly invitations: readonly OrganizationInvitation[]
  readonly invitationToken?: string
  readonly nextPageAvailable: boolean
  readonly notice?: string
  readonly onEmailInput: (value: string) => void
  readonly onNextPage: () => void
  readonly onPreviousPage: () => void
  readonly onRetry: () => void
  readonly onRevoke: (invitationId: string, email: string) => void
  readonly onRoleToggle: (role: OrganizationRoleId) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly onTokenDismiss: () => void
  readonly pendingId?: string
  readonly previousPageAvailable: boolean
  readonly roles: readonly OrganizationRole[]
  readonly selectedRoles: readonly OrganizationRoleId[]
  readonly status: OrganizationAdminStatus
  readonly validationMessage?: string
}) {
  return (
    <AuthenticatedPageBody>
      <OrganizationAdminNotice notice={props.notice} />

      <Show when={props.invitationToken}>
        {(token) => (
          <div class="min-w-0" data-one-time-secret="organization-invitation">
            <AuthenticatedSection
              actions={
                <Button onClick={props.onTokenDismiss} size="sm" variant="outline">
                  {messageTranslate("admin.organizations.invitations.tokenDismiss")}
                </Button>
              }
              class="border-accent/40"
              description={messageTranslate("admin.organizations.invitations.tokenOnce")}
              padded
              title={messageTranslate("admin.organizations.invitations.tokenTitle")}
            >
              <code class="block overflow-x-auto rounded-control border border-line-subtle bg-muted px-2 py-1.5 font-mono text-xs">
                {token()}
              </code>
            </AuthenticatedSection>
          </div>
        )}
      </Show>

      <AuthenticatedSection
        description={messageTranslate("admin.organizations.invitations.description")}
        title={messageTranslate("admin.organizations.invitations.create")}
      >
        <form class="grid gap-3 px-3 py-3" onSubmit={props.onSubmit}>
          <div class="grid items-end gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_auto]">
            <div class="grid min-w-0 gap-1">
              <Label for="invitation-email">{messageTranslate("admin.organizations.invitations.email")}</Label>
              <Input
                autocomplete="email"
                id="invitation-email"
                onInput={(event) => props.onEmailInput(event.currentTarget.value)}
                type="email"
                value={props.email}
              />
            </div>
            <OrganizationAdminRoleChooser
              idPrefix="invitation"
              legend={messageTranslate("admin.organizations.memberships.roles")}
              onToggle={props.onRoleToggle}
              roles={props.roles}
              selected={props.selectedRoles}
            />
            <Button disabled={props.pendingId === "invitation:create"} size="sm" type="submit">
              {messageTranslate("admin.organizations.invitations.create")}
            </Button>
          </div>
          <Show when={props.validationMessage}>
            {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
          </Show>
        </form>
      </AuthenticatedSection>

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.invitations.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <AuthenticatedSection title={messageTranslate("admin.organizations.invitations.title")}>
          <AuthenticatedRecordList label={messageTranslate("admin.organizations.invitations.title")}>
            <For each={props.invitations}>
              {(invitation) => (
                <AuthenticatedRecordItem
                  actions={
                    <Show when={invitation.status === "pending"}>
                      <Button
                        disabled={props.pendingId === `invitation:${invitation.id}`}
                        onClick={() => props.onRevoke(invitation.id, invitation.email)}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("admin.organizations.invitations.revoke")}
                      </Button>
                    </Show>
                  }
                  fields={[
                    {
                      label: messageTranslate("admin.organizations.memberships.roles"),
                      value: invitation.roles.join(", "),
                    },
                    {
                      label: messageTranslate("admin.organizations.invitations.expires"),
                      value: localeDateFormat(invitation.expiresAt, { dateStyle: "medium" }),
                    },
                  ]}
                  status={
                    <AuthenticatedStatus
                      label={messageTranslate(`admin.organizations.invitations.statusValue.${invitation.status}`)}
                      tone={organizationAdminInvitationStatusTone(invitation.status)}
                    />
                  }
                  title={invitation.email}
                />
              )}
            </For>
          </AuthenticatedRecordList>

          <Table
            aria-label={messageTranslate("admin.organizations.invitations.title")}
            class={authenticatedTableClasses.tableWide}
            tabIndex={0}
          >
            <TableHeader class={authenticatedTableClasses.header}>
              <TableRow>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.invitations.email")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.memberships.roles")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.status")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  {messageTranslate("admin.organizations.invitations.expires")}
                </TableHead>
                <TableHead class={authenticatedTableClasses.head}>
                  <span class="sr-only">{messageTranslate("admin.organizations.invitations.revoke")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.invitations}>
                {(invitation) => (
                  <TableRow class={authenticatedTableClasses.row}>
                    <TableCell class={`${authenticatedTableClasses.cell} font-medium`}>{invitation.email}</TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>{invitation.roles.join(", ")}</TableCell>
                    <TableCell class={authenticatedTableClasses.cell}>
                      <AuthenticatedStatus
                        label={messageTranslate(`admin.organizations.invitations.statusValue.${invitation.status}`)}
                        tone={organizationAdminInvitationStatusTone(invitation.status)}
                      />
                    </TableCell>
                    <TableCell class={`${authenticatedTableClasses.cell} whitespace-nowrap tabular-nums`}>
                      {localeDateFormat(invitation.expiresAt, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell class={authenticatedTableClasses.action}>
                      <Show when={invitation.status === "pending"}>
                        <Button
                          disabled={props.pendingId === `invitation:${invitation.id}`}
                          onClick={() => props.onRevoke(invitation.id, invitation.email)}
                          size="sm"
                          variant="outline"
                        >
                          {messageTranslate("admin.organizations.invitations.revoke")}
                        </Button>
                      </Show>
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
