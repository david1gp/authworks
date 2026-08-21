import { Show } from "solid-js"
import { Checkbox } from "#ui/input/check/Checkbox.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProjectAdminStateBoundary } from "./ProjectAdminStateBoundary.js"
import type { projectAdminDetailViewStateCreate } from "./projectAdminDetailViewStateCreate.js"
import { projectStatusBadgeVariant } from "./projectStatusBadgeVariant.js"

export function ProjectAdminDetailView(props: {
  readonly state: ReturnType<typeof projectAdminDetailViewStateCreate>
}) {
  const state = props.state
  return (
    <ProjectAdminStateBoundary
      emptyDetail={messageTranslate("admin.projects.list.empty")}
      error={state.page.error()}
      onRetry={state.page.reload}
      status={state.page.status()}
    >
      <Show when={state.page.project()}>
        {(project) => (
          <section class="grid gap-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 class="text-2xl font-semibold tracking-tight">{project().name}</h2>
                <p class="mt-1 font-mono text-xs text-muted-foreground">{project().id}</p>
              </div>
              <Badge variant={projectStatusBadgeVariant(project().status)}>{project().status}</Badge>
            </div>

            <CardWrapper>
              <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem
                  label={messageTranslate("admin.projects.detail.organization")}
                  value={state.page.organizationName(project().organizationId)}
                />
                <DetailItem
                  label={messageTranslate("admin.projects.detail.created")}
                  value={new Date(project().createdAt).toLocaleString()}
                />
                <DetailItem
                  label={messageTranslate("admin.projects.detail.updated")}
                  value={new Date(project().updatedAt).toLocaleString()}
                />
                <DetailItem label={messageTranslate("admin.projects.status")} value={project().status} />
              </dl>
            </CardWrapper>

            <CardWrapper>
              <h3 class="text-xl font-semibold">{messageTranslate("admin.projects.detail.settingsTitle")}</h3>
              <p class="mt-1 text-sm text-muted-foreground">
                {messageTranslate("admin.projects.detail.settingsDescription")}
              </p>
              <form class="mt-5 grid max-w-xl gap-4" onSubmit={state.settingsSubmit}>
                <div class="grid gap-2">
                  <Label for="project-detail-name">{messageTranslate("admin.projects.list.name")}</Label>
                  <Input
                    id="project-detail-name"
                    onInput={(event) => state.name.set(event.currentTarget.value)}
                    value={state.name.get()}
                  />
                </div>
                <Checkbox
                  checked={state.authorizationRequired.get()}
                  id="project-authorization-required"
                  onChange={state.authorizationRequired.set}
                >
                  {messageTranslate("admin.projects.detail.authorizationRequired")}
                </Checkbox>
                <Checkbox
                  checked={state.projectAccessRequired.get()}
                  id="project-access-required"
                  onChange={state.projectAccessRequired.set}
                >
                  {messageTranslate("admin.projects.detail.projectAccessRequired")}
                </Checkbox>
                <Show when={state.page.notice()}>
                  {(name) => (
                    <p class="text-sm text-success" role="status">
                      {messageTranslate("admin.projects.saved", { name: name() })}
                    </p>
                  )}
                </Show>
                <div class="flex flex-wrap gap-2">
                  <Button disabled={state.page.pendingId() !== undefined} type="submit" variant="filledBlue">
                    {messageTranslate("common.save")}
                  </Button>
                  <Show when={project().status === "active"}>
                    <Button
                      disabled={state.page.pendingId() !== undefined}
                      onClick={() => state.page.projectLifecycleSet(project().id, "inactive")}
                      type="button"
                      variant="outline"
                    >
                      {messageTranslate("admin.projects.lifecycle.deactivate")}
                    </Button>
                  </Show>
                  <Show when={project().status === "inactive"}>
                    <Button
                      disabled={state.page.pendingId() !== undefined}
                      onClick={() => state.page.projectLifecycleSet(project().id, "active")}
                      type="button"
                      variant="outline"
                    >
                      {messageTranslate("admin.projects.lifecycle.activate")}
                    </Button>
                  </Show>
                  <Button
                    disabled={state.page.pendingId() !== undefined}
                    onClick={() => void state.projectDelete(project().id)}
                    type="button"
                    variant="filledRed"
                  >
                    {messageTranslate("admin.projects.lifecycle.remove")}
                  </Button>
                </div>
              </form>
            </CardWrapper>
          </section>
        )}
      </Show>
    </ProjectAdminStateBoundary>
  )
}

function DetailItem(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt class="text-sm text-muted-foreground">{props.label}</dt>
      <dd class="mt-1 break-all text-sm">{props.value}</dd>
    </div>
  )
}
