import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { projectAdminRolesGrantsViewStateCreate } from "./projectAdminRolesGrantsViewStateCreate.js"
import { projectStatusBadgeVariant } from "./projectStatusBadgeVariant.js"

export function ProjectAdminRolesGrantsView(props: {
  readonly state: ReturnType<typeof projectAdminRolesGrantsViewStateCreate>
}) {
  const state = props.state
  return (
    <ProjectAdminStateBoundary
      emptyDetail={messageTranslate("admin.projects.roles.empty")}
      error={state.page.error()}
      onRetry={state.page.reload}
      status={state.page.status()}
    >
      <div class="grid gap-8">
        <section class="grid gap-4">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.projects.roles.title")}</h1>
              <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("admin.projects.roles.description")}</p>
            </div>
            <CorvuDialog
              buttonChildren={messageTranslate("admin.projects.roles.create")}
              description={messageTranslate("admin.projects.roles.description")}
              onOpenChange={state.roleCreateOpenSet}
              open={state.roleCreateOpen()}
              title={messageTranslate("admin.projects.roles.create")}
              variant="filledBlue"
            >
              <form class="grid gap-4" onSubmit={state.roleCreateSubmit}>
                <div class="grid gap-2">
                  <Label for="role-key">{messageTranslate("admin.projects.roles.key")}</Label>
                  <Input
                    id="role-key"
                    onInput={(event) => state.roleKey.set(event.currentTarget.value)}
                    value={state.roleKey.get()}
                  />
                </div>
                <div class="grid gap-2">
                  <Label for="role-display-name">{messageTranslate("admin.projects.roles.displayName")}</Label>
                  <Input
                    id="role-display-name"
                    onInput={(event) => state.roleDisplayName.set(event.currentTarget.value)}
                    value={state.roleDisplayName.get()}
                  />
                </div>
                <div class="grid gap-2">
                  <Label for="role-group">{messageTranslate("admin.projects.roles.group")}</Label>
                  <Input
                    id="role-group"
                    onInput={(event) => state.roleGroup.set(event.currentTarget.value)}
                    value={state.roleGroup.get()}
                  />
                </div>
                <Show when={state.roleFormError()}>
                  {(message) => (
                    <p class="text-sm text-danger" role="alert">
                      {message()}
                    </p>
                  )}
                </Show>
                <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
                  {messageTranslate("common.save")}
                </Button>
              </form>
            </CorvuDialog>
          </div>
          <CardWrapper>
            <Show
              when={state.page.roles().length > 0}
              fallback={
                <p class="py-6 text-center text-muted-foreground">{messageTranslate("admin.projects.roles.empty")}</p>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{messageTranslate("admin.projects.roles.key")}</TableHead>
                    <TableHead>{messageTranslate("admin.projects.roles.displayName")}</TableHead>
                    <TableHead>{messageTranslate("admin.projects.roles.group")}</TableHead>
                    <TableHead class="text-right">{messageTranslate("common.save")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={state.page.roles()}>
                    {(role) => (
                      <TableRow>
                        <TableCell class="font-mono">{role.key}</TableCell>
                        <TableCell>{role.displayName}</TableCell>
                        <TableCell>{role.group ?? "—"}</TableCell>
                        <TableCell class="text-right">
                          <Button
                            disabled={state.page.pendingId() !== undefined}
                            onClick={() => state.roleDelete(role.id)}
                            variant="filledRed"
                          >
                            {messageTranslate("admin.projects.lifecycle.remove")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </Show>
          </CardWrapper>
        </section>

        <section class="grid gap-4">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 class="text-2xl font-semibold tracking-tight">{messageTranslate("admin.projects.grants.title")}</h2>
              <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("admin.projects.grants.description")}</p>
            </div>
            <CorvuDialog
              buttonChildren={messageTranslate("admin.projects.grants.create")}
              description={messageTranslate("admin.projects.grants.description")}
              onOpenChange={state.grantCreateOpenSet}
              open={state.grantCreateOpen()}
              title={messageTranslate("admin.projects.grants.create")}
              variant="filledBlue"
            >
              <form class="grid gap-4" onSubmit={state.grantCreateSubmit}>
                <div class="grid gap-2">
                  <Label for="grant-organization">
                    {messageTranslate("admin.projects.grants.grantedOrganization")}
                  </Label>
                  <SelectSingleNative
                    getOptions={() => state.grantableOrganizations().map((organization) => organization.id)}
                    id="grant-organization"
                    valueSignal={state.grantOrganizationId}
                    valueText={(id) => state.page.organizationName(id)}
                  />
                </div>
                <fieldset class="grid gap-2">
                  <legend class="text-sm font-medium">{messageTranslate("admin.projects.grants.roleKeys")}</legend>
                  <For each={state.page.roles()}>
                    {(role) => (
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          checked={state.grantRoleKeys.get().includes(role.key)}
                          onChange={() => state.grantRoleToggle(role.key)}
                          type="checkbox"
                        />
                        <span>{role.displayName}</span>
                        <code class="text-xs text-muted-foreground">{role.key}</code>
                      </label>
                    )}
                  </For>
                </fieldset>
                <Show when={state.grantFormError()}>
                  {(message) => (
                    <p class="text-sm text-danger" role="alert">
                      {message()}
                    </p>
                  )}
                </Show>
                <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
                  {messageTranslate("common.save")}
                </Button>
              </form>
            </CorvuDialog>
          </div>
          <CardWrapper>
            <Show
              when={state.page.grants().length > 0}
              fallback={
                <p class="py-6 text-center text-muted-foreground">{messageTranslate("admin.projects.grants.empty")}</p>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{messageTranslate("admin.projects.grants.grantedOrganization")}</TableHead>
                    <TableHead>{messageTranslate("admin.projects.grants.roleKeys")}</TableHead>
                    <TableHead>{messageTranslate("admin.projects.status")}</TableHead>
                    <TableHead class="text-right">{messageTranslate("common.save")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={state.page.grants()}>
                    {(grant) => (
                      <TableRow>
                        <TableCell class="font-medium">
                          <span>{state.page.organizationName(grant.grantedOrganizationId)}</span>
                          <Show when={grant.grantedOrganizationId !== grant.organizationId}>
                            <span class="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {messageTranslate("admin.projects.access.grantedOrganization")}
                            </span>
                          </Show>
                        </TableCell>
                        <TableCell>{grant.roleKeys.join(", ") || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={projectStatusBadgeVariant(grant.status)}>{grant.status}</Badge>
                        </TableCell>
                        <TableCell class="text-right">
                          <div class="flex justify-end gap-2">
                            <Show when={grant.status === "active"}>
                              <Button
                                disabled={state.page.pendingId() !== undefined}
                                onClick={() => state.grantLifecycleSet(grant.id, "inactive")}
                                variant="outline"
                              >
                                {messageTranslate("admin.projects.lifecycle.deactivate")}
                              </Button>
                            </Show>
                            <Show when={grant.status === "inactive"}>
                              <Button
                                disabled={state.page.pendingId() !== undefined}
                                onClick={() => state.grantLifecycleSet(grant.id, "active")}
                                variant="outline"
                              >
                                {messageTranslate("admin.projects.lifecycle.activate")}
                              </Button>
                            </Show>
                            <Button
                              disabled={state.page.pendingId() !== undefined}
                              onClick={() => state.grantDelete(grant.id)}
                              variant="filledRed"
                            >
                              {messageTranslate("common.revoke")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </Show>
          </CardWrapper>
        </section>
      </div>
    </ProjectAdminStateBoundary>
  )
}
