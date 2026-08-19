import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { CorvuDialog } from "#ui/interactive/dialog/CorvuDialog.jsx"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#ui/table/Table.jsx"
import { userListStateCreate } from "./userListStateCreate.js"

export function UserList() {
  const state = userListStateCreate()
  return (
    <PageWrapper class="bg-transparent" innerClass="max-w-6xl">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-blue-600">Administration</p>
          <h1 class="text-3xl font-semibold tracking-tight">Users</h1>
          <p class="mt-1 text-muted-foreground">Manage users across the realm.</p>
        </div>
        <CorvuDialog
          title="Create user"
          description="Add a user to the demo realm."
          variant="filledBlue"
          buttonChildren="Create user"
          open={state.createOpen()}
          onOpenChange={state.createOpenSet}
        >
          <form class="grid gap-4" onSubmit={state.submit}>
            <div class="grid gap-2">
              <Label for="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={state.email()}
                onInput={(event) => state.onEmail(event.currentTarget.value)}
              />
            </div>
            <div class="grid gap-2">
              <Label for="user-name">Username</Label>
              <Input
                id="user-name"
                value={state.userName()}
                onInput={(event) => state.onUserName(event.currentTarget.value)}
              />
            </div>
            <div class="grid gap-2">
              <Label for="user-display-name">Display name (optional)</Label>
              <Input
                id="user-display-name"
                value={state.displayName()}
                onInput={(event) => state.onDisplayName(event.currentTarget.value)}
              />
            </div>
            <Show when={state.error()}>
              <p class="text-sm text-red-600">{state.error()}</p>
            </Show>
            <Button type="submit" variant="filledBlue">
              Create
            </Button>
          </form>
        </CorvuDialog>
      </div>
      <CardWrapper class="mt-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Label for="user-search" class="sr-only">
            Search users
          </Label>
          <Input
            id="user-search"
            class="max-w-sm"
            placeholder="Search by username, email or id"
            value={state.query()}
            onInput={(event) => state.searchSet(event.currentTarget.value)}
          />
          <span class="text-sm text-muted-foreground">{state.filteredUsers().length} users</span>
        </div>
        <Show
          when={state.filteredUsers().length > 0}
          fallback={<p class="py-8 text-center text-muted-foreground">No users found.</p>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={state.filteredUsers()}>
                {(user) => (
                  <TableRow class="cursor-pointer" onClick={() => state.openUser(user.id)}>
                    <TableCell class="font-medium">{user.userName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.emailVerified ? "filledGreen" : "subtle"}>
                        {user.emailVerified ? "verified" : "unverified"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={state.badgeVariant(user.state)}>{user.state}</Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </Show>
      </CardWrapper>
    </PageWrapper>
  )
}
