import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationInvitation } from "../public/organizationInvitationSchema.js"
import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"
import type { OrganizationRole } from "../public/organizationRoleSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminPagination } from "./OrganizationAdminPagination.js"
import { OrganizationAdminRoleChooser } from "./OrganizationAdminRoleChooser.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
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
    <section class="grid gap-5">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          {messageTranslate("admin.organizations.invitations.title")}
        </h1>
        <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {messageTranslate("admin.organizations.invitations.description")}
        </p>
      </div>
      <OrganizationAdminNotice notice={props.notice} />
      <Show when={props.invitationToken}>
        {(token) => (
          <article
            class="rounded-2xl border border-accent/40 bg-surface p-5 shadow-sm"
            data-one-time-secret="organization-invitation"
          >
            <h3 class="font-semibold">{messageTranslate("admin.organizations.invitations.tokenTitle")}</h3>
            <p class="mt-2 text-sm text-muted-foreground">
              {messageTranslate("admin.organizations.invitations.tokenOnce")}
            </p>
            <code class="mt-4 block overflow-x-auto rounded-lg bg-muted p-3 text-sm">{token()}</code>
            <Button class="mt-5" onClick={props.onTokenDismiss} variant="outline">
              {messageTranslate("admin.organizations.invitations.tokenDismiss")}
            </Button>
          </article>
        )}
      </Show>
      <CardWrapper>
        <h3 class="text-lg font-semibold">{messageTranslate("admin.organizations.invitations.create")}</h3>
        <form class="mt-4 grid gap-4" onSubmit={props.onSubmit}>
          <div class="grid gap-2">
            <Label for="invitation-email">{messageTranslate("admin.organizations.invitations.email")}</Label>
            <Input
              autocomplete="email"
              class="max-w-md"
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
          <Show when={props.validationMessage}>
            {(message) => (
              <p class="text-sm text-danger" role="alert">
                {message()}
              </p>
            )}
          </Show>
          <div>
            <Button disabled={props.pendingId === "invitation:create"} type="submit" variant="filledBlue">
              {messageTranslate("admin.organizations.invitations.create")}
            </Button>
          </div>
        </form>
      </CardWrapper>
      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.invitations.empty")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <CardWrapper>
          <Table aria-label={messageTranslate("admin.organizations.invitations.title")} tabIndex={0}>
            <TableHeader>
              <TableRow>
                <TableHead>{messageTranslate("admin.organizations.invitations.email")}</TableHead>
                <TableHead>{messageTranslate("admin.organizations.memberships.roles")}</TableHead>
                <TableHead>{messageTranslate("admin.organizations.status")}</TableHead>
                <TableHead>{messageTranslate("admin.organizations.invitations.expires")}</TableHead>
                <TableHead class="text-right">
                  <span class="sr-only">{messageTranslate("admin.organizations.invitations.revoke")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.invitations}>
                {(invitation) => (
                  <TableRow>
                    <TableCell class="font-medium">{invitation.email}</TableCell>
                    <TableCell>{invitation.roles.join(", ")}</TableCell>
                    <TableCell>
                      <Badge variant={invitation.status === "pending" ? "filledYellow" : "filledGreen"}>
                        {messageTranslate(`admin.organizations.invitations.statusValue.${invitation.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{localeDateFormat(invitation.expiresAt, { dateStyle: "medium" })}</TableCell>
                    <TableCell class="text-right">
                      <Show when={invitation.status === "pending"}>
                        <Button
                          disabled={props.pendingId === `invitation:${invitation.id}`}
                          onClick={() => props.onRevoke(invitation.id, invitation.email)}
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
