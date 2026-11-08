import type { Page, Route } from "@playwright/test"
import { expect } from "@playwright/test"
import { e2eBrowserConsoleTest as test } from "./harness/e2eBrowserConsoleTest.js"
import { productionAdminSessionBootstrap } from "./productionAdminSessionBootstrap.js"

// Teams flow against the production /orgs/{slug}/users surface with a route-mocked
// backend, following e2e/organizationAdminProduction.spec.ts: the real
// production UI and API clients run, HTTP is stubbed, and the spec asserts the
// exact request paths, methods, bodies, and rendered state. A pure
// demo-fixture click-through would not touch the teams API client paths, so it
// is deliberately not used here.

// Payloads must satisfy the public UUIDv7-shaped resource identifier schema.
const realmId = "018f0000-0000-7000-8000-000000000001"
const organizationId = "018f0000-0000-7000-8000-000000000002"
const organizationName = "Northwind Labs"
const organizationSlug = "northwind-labs"
const organization = {
  createdAt: 1_700_000_000_000,
  id: organizationId,
  name: organizationName,
  realmId,
  slug: organizationSlug,
  status: "active",
  updatedAt: 1_700_000_000_000,
}
const leaderUserId = "018f0000-0000-7000-8000-000000000021"
const memberUserId = "018f0000-0000-7000-8000-000000000022"
const outsiderUserId = "018f0000-0000-7000-8000-000000000023"
const adminUserId = "01900000-0000-7000-8000-0000000000b1"
const teamId = "018f0000-0000-7000-8000-000000000031"
const teamSlug = "platform-team"
const teamName = "Platform Team"
const realmApiPath = new RegExp(`/realms/${realmId}/(?!sessions/current(?:\\?|$))`)

type MockUser = {
  readonly displayName: string
  readonly email: string
  readonly id: string
  readonly userName: string
}

const leader: MockUser = {
  displayName: "Alex Morgan",
  email: "alex.morgan@northwind.example",
  id: leaderUserId,
  userName: "alex.morgan",
}

const member: MockUser = {
  displayName: "Robin Casey",
  email: "robin.casey@northwind.example",
  id: memberUserId,
  userName: "robin.casey",
}

const outsider: MockUser = {
  displayName: "Sam Rivera",
  email: "sam.rivera@northwind.example",
  id: outsiderUserId,
  userName: "sam.rivera",
}

const allUsers: readonly MockUser[] = [leader, member, outsider]

type MockTeam = {
  readonly createdAt: number
  readonly id: string
  readonly leader: { readonly displayName: string; readonly email: string; readonly userId: string }
  readonly name: string
  readonly organizationId: string
  readonly realmId: string
  readonly slug: string
  readonly updatedAt: number
}

type TeamsMockState = {
  readonly assignments: Map<string, string>
  postedAssignBody: unknown
  postedCreateBody: unknown
  team: MockTeam | null
}

function teamsMockStateCreate(): TeamsMockState {
  return { assignments: new Map(), postedAssignBody: undefined, postedCreateBody: undefined, team: null }
}

function mockUserPayload(user: MockUser) {
  return {
    createdAt: 1_700_000_000_000,
    email: user.email,
    emailVerified: true,
    id: user.id,
    profile: { displayName: user.displayName },
    realmId,
    state: "active",
    updatedAt: 1_700_000_000_000,
    userName: user.userName,
    verificationState: "verified",
  }
}

function mockDirectoryEntry(user: MockUser, state: TeamsMockState) {
  const assignedTeamId = state.assignments.get(user.id)
  const team = state.team !== null && state.team.id === assignedTeamId ? state.team : null
  return {
    memberships: [
      {
        createdAt: 1_700_000_000_000,
        membershipId: `018f0000-0000-7000-8000-0000000001${user.id.slice(-2)}`,
        organizationId,
        organizationName,
        roles: ["member"],
      },
    ],
    team:
      team === null
        ? null
        : {
            id: team.id,
            name: team.name,
            slug: team.slug,
          },
    user: {
      createdAt: 1_700_000_000_000,
      displayName: user.displayName,
      email: user.email,
      emailVerified: true,
      id: user.id,
      lastSignInAt: 1_700_000_050_000,
      state: "active",
      userName: user.userName,
      verificationState: "verified",
    },
  }
}

function mockTeamPayload(team: MockTeam, memberCount: number) {
  return { ...team, memberCount }
}

async function teamsBackendMock(page: Page, state: TeamsMockState) {
  await page.route(realmApiPath, async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    // The user session, its owner membership (slug included), and the tenant list that
    // realm administrators resolve slugs through.
    if (pathname === `/realms/${realmId}/me/organizations`)
      return route.fulfill({
        json: {
          items: [
            {
              membership: {
                createdAt: 1_700_000_000_000,
                id: "018f0000-0000-7000-8000-000000000022",
                organizationId,
                realmId,
                roles: ["owner"],
                updatedAt: 1_700_000_000_000,
                userId: adminUserId,
              },
              organization,
            },
          ],
        },
      })
    if (pathname === `/realms/${realmId}/me`)
      return route.fulfill({
        json: {
          capabilities: { realmAdministrator: true, realmRead: true },
          user: {
            createdAt: 1_700_000_000_000,
            email: "admin@customer.example",
            emailVerified: true,
            id: adminUserId,
            profile: { displayName: "Customer admin" },
            realmId,
            state: "active",
            updatedAt: 1_700_000_000_000,
            userName: "customer-admin",
            verificationState: "verified",
          },
        },
      })
    if (pathname === `/realms/${realmId}/organizations`) return route.fulfill({ json: { items: [organization] } })
    if (pathname.endsWith(`/organizations/${organizationId}/teams`) && request.method() === "POST") {
      const body = request.postDataJSON() as { leaderUserId: string; name: string; slug: string }
      state.postedCreateBody = body
      const team: MockTeam = {
        createdAt: 1_700_000_000_000,
        id: teamId,
        leader: { displayName: leader.displayName, email: leader.email, userId: body.leaderUserId },
        name: body.name,
        organizationId,
        realmId,
        slug: body.slug,
        updatedAt: 1_700_000_000_000,
      }
      state.team = team
      // The leader automatically holds a membership row.
      state.assignments.set(body.leaderUserId, team.id)
      return route.fulfill({ json: { team: mockTeamPayload(team, state.assignments.size) } })
    }
    if (pathname.endsWith(`/organizations/${organizationId}/teams`)) {
      const team = state.team
      const assignedCount = team === null ? 0 : [...state.assignments.values()].filter((id) => id === team.id).length
      return route.fulfill({
        json: {
          items: team === null ? [] : [mockTeamPayload(team, assignedCount)],
          unassignedCount: allUsers.length - assignedCount,
        },
      })
    }
    if (pathname.includes(`/organizations/${organizationId}/teams/`) && pathname.endsWith("/members")) {
      const body = request.postDataJSON() as { userId: string }
      state.postedAssignBody = body
      const team = state.team
      if (team === null) return route.fulfill({ status: 404, json: { errorMessage: "Team not found." } })
      state.assignments.set(body.userId, team.id)
      const assignedCount = [...state.assignments.values()].filter((id) => id === team.id).length
      return route.fulfill({ json: { team: mockTeamPayload(team, assignedCount) } })
    }
    if (pathname.endsWith(`/organizations/${organizationId}/users/summary`)) {
      return route.fulfill({ json: { roles: { admin: 0, guest: 0, member: 3, owner: 1 }, total: 4 } })
    }
    if (pathname.endsWith(`/organizations/${organizationId}/users`)) {
      const teamFilter = url.searchParams.get("team")
      const search = url.searchParams.get("search")?.toLowerCase() ?? ""
      const visible = allUsers
        .map((user) => mockDirectoryEntry(user, state))
        .filter((entry) => {
          if (teamFilter === "unassigned" && entry.team !== null) return false
          if (teamFilter !== null && teamFilter !== "unassigned") {
            if (entry.team?.slug !== teamFilter) return false
          }
          if (search.length > 0) {
            const haystack = `${entry.user.displayName ?? ""} ${entry.user.email} ${entry.user.userName}`.toLowerCase()
            if (!haystack.includes(search)) return false
          }
          return true
        })
      return route.fulfill({ json: { items: visible } })
    }
    if (pathname.endsWith(`/organizations/${organizationId}/invitations`)) {
      return route.fulfill({ json: { items: [] } })
    }
    if (pathname.endsWith(`/users/${member.id}/access`)) {
      return route.fulfill({
        json: {
          memberships: [
            {
              createdAt: 1_700_000_000_000,
              invitedBy: {
                acceptedAt: null,
                displayName: "Customer admin",
                email: "admin@customer.example",
                invitedAt: 1_700_000_000_000,
                userId: adminUserId,
              },
              membershipId: "018f0000-0000-7000-8000-000000000122",
              organizationId,
              organizationName,
              roles: ["member"],
            },
          ],
          projectAssignments: [],
          realmAdministrator: false,
        },
      })
    }
    if (pathname.endsWith("/access")) {
      return route.fulfill({ json: { memberships: [], projectAssignments: [], realmAdministrator: false } })
    }
    for (const user of allUsers) {
      if (pathname.endsWith(`/users/${user.id}`)) return route.fulfill({ json: { user: mockUserPayload(user) } })
    }
    return route.fulfill({ json: { items: [] } })
  })
}

test.beforeEach(async ({ page }) => {
  await productionAdminSessionBootstrap(page, { organizationId, organizationName, realmId })
  // Organization slug URLs resolve through the session organization list, which is only
  // populated for user sessions, so the bootstrap session is overridden with a user session
  // here. The backend mock below serves the matching /me payloads.
  await page.route(`**/realms/${realmId}/sessions/current`, (route) =>
    route.fulfill({
      json: {
        session: {
          assurance: "authenticated",
          authenticationMethod: "password",
          createdAt: 1_700_000_000_000,
          current: true,
          device: {},
          expiresAt: 1_700_000_900_000,
          id: "01900000-0000-7000-8000-0000000000a1",
          lastUsedAt: 1_700_000_050_000,
          organizationId,
          realmId,
          revokedAt: null,
          subjectId: adminUserId,
          subjectType: "user",
          userId: adminUserId,
        },
      },
    }),
  )
})

test("creating a team posts name, slug, and leader and opens the team detail", async ({ page }) => {
  const state = teamsMockStateCreate()
  await teamsBackendMock(page, state)

  await page.goto(`/orgs/${organizationSlug}/users?tab=teams`)

  await expect(page.getByText("No teams exist in this organization yet.", { exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole("button", { name: "Create team", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.locator("#directory-team-create-name").fill(teamName)
  // The slug auto-suggests from the name until the admin edits it manually.
  await expect(dialog.locator("#directory-team-create-slug")).toHaveValue(teamSlug)
  await dialog.locator("#directory-team-create-slug").fill(teamSlug)
  await expect(dialog.getByText(`team=${teamSlug}`, { exact: false })).toBeVisible()

  await dialog.getByPlaceholder("Search", { exact: true }).fill(leader.userName)
  await dialog.getByPlaceholder("Search", { exact: true }).press("Enter")
  await dialog.getByRole("radio", { name: new RegExp(leader.displayName) }).check()

  const createResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(`/organizations/${organizationId}/teams`) &&
      response.request().method() === "POST",
  )
  await dialog.getByRole("button", { name: "Create team", exact: true }).click()
  await createResponse

  expect(state.postedCreateBody).toEqual({ leaderUserId: leader.id, name: teamName, slug: teamSlug })
  await expect(page).toHaveURL(new RegExp(`team=${teamSlug}`))
  await expect(page.getByText(`Team ${teamName} was created.`)).toBeVisible()
  await expect(page.getByRole("heading", { name: teamName })).toBeVisible()
  await expect(page.getByRole("row", { name: new RegExp(leader.displayName) })).toContainText("Leader")
})

test("an invalid slug blocks team creation without a request", async ({ page }) => {
  const state = teamsMockStateCreate()
  await teamsBackendMock(page, state)

  await page.goto(`/orgs/${organizationSlug}/users?tab=teams`)
  await expect(page.getByText("No teams exist in this organization yet.", { exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole("button", { name: "Create team", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.locator("#directory-team-create-name").fill(teamName)
  await dialog.locator("#directory-team-create-slug").fill("Not A Slug!")
  await dialog.getByRole("button", { name: "Create team", exact: true }).click()

  await expect(
    dialog.getByText("Use lowercase letters, digits, and single hyphens, without leading or trailing hyphens", {
      exact: false,
    }),
  ).toBeVisible()
  expect(state.postedCreateBody).toBeUndefined()
})

test("assigning a person surfaces them in the team-filtered people list with a team column", async ({ page }) => {
  const state = teamsMockStateCreate()
  await teamsBackendMock(page, state)
  // Seed the created team: the leader automatically holds a membership row.
  state.team = {
    createdAt: 1_700_000_000_000,
    id: teamId,
    leader: { displayName: leader.displayName, email: leader.email, userId: leader.id },
    name: teamName,
    organizationId,
    realmId,
    slug: teamSlug,
    updatedAt: 1_700_000_000_000,
  }
  state.assignments.set(leader.id, teamId)

  await page.goto(`/orgs/${organizationSlug}/users?tab=teams&team=${teamSlug}`)
  await expect(page.getByRole("heading", { name: teamName }).first()).toBeVisible({ timeout: 30_000 })

  const addSection = page.getByRole("region", { name: "Add member", exact: true })
  await addSection.getByPlaceholder("Search", { exact: true }).fill(member.userName)
  await addSection.getByPlaceholder("Search", { exact: true }).press("Enter")
  const memberRow = page.getByRole("listitem").filter({ hasText: member.email })
  await expect(memberRow).toBeVisible()
  const assignResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(`/teams/${teamSlug}/members`) && response.request().method() === "POST",
  )
  await memberRow.getByRole("button", { name: "Add", exact: true }).click()
  await assignResponse

  expect(state.postedAssignBody).toEqual({ userId: member.id })
  await expect(page.getByText(`${member.displayName} was added to ${teamName}.`)).toBeVisible()

  await page.goto(`/orgs/${organizationSlug}/users?tab=people`)
  const peopleTable = page.getByRole("table", { name: "People" })
  await expect(peopleTable).toBeVisible({ timeout: 30_000 })
  await page.locator("#directory-team-filter").selectOption(teamSlug)
  await expect(page).toHaveURL(new RegExp(`team=${teamSlug}`))
  await expect(peopleTable.getByText(member.displayName, { exact: true })).toBeVisible()
  await expect(peopleTable.getByText(teamName, { exact: true }).first()).toBeVisible()
  await expect(peopleTable.getByText(outsider.displayName, { exact: true })).toBeHidden()

  await page.locator("#directory-team-filter").selectOption("unassigned")
  await expect(peopleTable.getByText(outsider.displayName, { exact: true })).toBeVisible()
  await expect(peopleTable.getByText(member.displayName, { exact: true })).toBeHidden()
  await expect(peopleTable.getByText(leader.displayName, { exact: true })).toBeHidden()
})

test("the profile shows the team and the inviter while unassigned lists everyone else", async ({ page }) => {
  const state = teamsMockStateCreate()
  await teamsBackendMock(page, state)
  state.team = {
    createdAt: 1_700_000_000_000,
    id: teamId,
    leader: { displayName: leader.displayName, email: leader.email, userId: leader.id },
    name: teamName,
    organizationId,
    realmId,
    slug: teamSlug,
    updatedAt: 1_700_000_000_000,
  }
  state.assignments.set(leader.id, teamId)
  state.assignments.set(member.id, teamId)

  // Team and invited-by render on the access tab, gated on the org membership.
  await page.goto(`/orgs/${organizationSlug}/users/${member.id}?tab=access`)
  await expect(page.getByText("Customer admin", { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText("admin@customer.example", { exact: true }).first()).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Team", exact: true }).getByText(teamName, { exact: true }).first(),
  ).toBeVisible()

  // The unassigned roster renders in the desktop members table (and the
  // mobile record list below `md`).
  await page.setViewportSize({ height: 800, width: 1280 })
  await page.goto(`/orgs/${organizationSlug}/users?tab=teams&team=unassigned`)
  await expect(page.getByText("People in this organization who are in no team.", { exact: true })).toBeVisible({
    timeout: 30_000,
  })
  const unassignedTable = page.getByRole("table", { name: "Unassigned" })
  await expect(unassignedTable).toBeVisible()
  await expect(unassignedTable.getByText(outsider.displayName, { exact: true })).toBeVisible()
  await expect(unassignedTable.getByRole("combobox", { name: "Team", exact: true }).first()).toBeVisible()
  await expect(unassignedTable.getByRole("button", { name: "Add", exact: true }).first()).toBeVisible()
  await expect(page.getByText(member.displayName, { exact: true })).toBeHidden()
  await expect(page.getByText(leader.displayName, { exact: true })).toBeHidden()
})
