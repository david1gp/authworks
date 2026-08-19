import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { userDetailStateCreate } from "./userDetailStateCreate.js"

export function UserDetail() {
  const state = userDetailStateCreate()
  return (
    <PageWrapper class="bg-transparent" innerClass="max-w-5xl">
      <Show when={state.user()} fallback={<NotFound backHref={state.backHref} />}>
        {(user) => (
          <>
            <A class="text-sm text-muted-foreground hover:underline" href={state.backHref}>
              ← Users
            </A>
            <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 class="text-3xl font-semibold tracking-tight">{user().profile.displayName ?? user().userName}</h1>
                <p class="mt-1 font-mono text-xs text-muted-foreground">{user().id}</p>
              </div>
              <div class="flex gap-2">
                <Badge variant={user().emailVerified ? "filledGreen" : "subtle"}>
                  {user().emailVerified ? "verified" : "unverified"}
                </Badge>
                <Badge
                  variant={state.stateVariant(
                    user().state as "initial" | "active" | "inactive" | "locked" | "suspended" | "deleted",
                  )}
                >
                  {user().state}
                </Badge>
              </div>
            </div>
            <CardWrapper class="mt-6">
              <dl class="grid gap-5 sm:grid-cols-2">
                <DetailItem label="Username" value={user().userName} />
                <DetailItem label="Email" value={user().email} />
                <DetailItem label="Realm" value={user().realmId} />
                <DetailItem label="Created" value={new Date(user().createdAt).toLocaleString()} />
                <DetailItem label="Updated" value={new Date(user().updatedAt).toLocaleString()} />
                <DetailItem label="Profile" value={profileText(user().profile)} />
              </dl>
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
      <h1 class="text-2xl font-semibold">User not found</h1>
      <A class="text-blue-600 hover:underline" href={props.backHref}>
        Back to users
      </A>
    </div>
  )
}
function DetailItem(props: { label: string; value: string }) {
  return (
    <div>
      <dt class="text-sm text-muted-foreground">{props.label}</dt>
      <dd class="mt-1 break-all text-sm">{props.value}</dd>
    </div>
  )
}
function profileText(profile: {
  displayName?: string
  firstName?: string
  lastName?: string
  gender?: string
  nickName?: string
  preferredLanguage?: string
}) {
  return (
    Object.entries(profile)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" · ") || "No profile fields"
  )
}
