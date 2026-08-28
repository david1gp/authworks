import { expect, test } from "@playwright/test"

const projectId = "01900000-0000-7000-8000-000000000031"
const projectBase = `/demo/admin/projects/${projectId}`

test("the project directory lists fixtures and creates a project without a network call", async ({ page }) => {
  await page.goto("/demo/admin/projects")

  await expect(page.getByRole("heading", { level: 1, name: "Project directory", exact: true })).toBeVisible()
  // Projects render as a wide table on desktop and as a stacked record list on mobile; assert the visible one.
  await expect(page.getByRole("table").getByText("Acme Portal", { exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("Acme Corporation", { exact: true })).toBeVisible()

  await page.getByLabel("Search projects", { exact: true }).fill("globex")
  await expect(page).toHaveURL(/q=globex/)
  await expect(page.getByRole("table").getByText("Globex Console", { exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("Acme Portal", { exact: true })).toHaveCount(0)

  await page.getByLabel("Search projects", { exact: true }).fill("")
  await page.getByRole("button", { name: "Create project", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(page).toHaveURL(/dialog=project/)
  await dialog.getByLabel("Project name", { exact: true }).fill("E2E Project")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByRole("table").getByText("E2E Project", { exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/dialog=/)
})

const stateDestinations = {
  applications: `${projectBase}/applications`,
  "effective-access": `${projectBase}/effective-access`,
  projects: "/demo/admin/projects",
  "roles-grants": `${projectBase}/roles-grants`,
} as const

for (const [name, path] of Object.entries(stateDestinations)) {
  test(`the ${name} destination exposes URL-selectable fixture states`, async ({ page }) => {
    await page.goto(`${path}?state=empty`)
    await expect(page.locator("[data-content-state='empty']").first()).toBeVisible()

    await page.goto(`${path}?state=error`)
    await expect(page.locator("[data-content-state='error']")).toBeVisible()
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible()

    await page.goto(`${path}?state=loading`)
    await expect(page.locator("[data-content-state='loading']")).toBeVisible()

    await page.goto(`${path}?state=permission-denied`)
    await expect(page.locator("[data-content-state='inaccessible']")).toContainText("permission")

    await page.goto(`${path}?state=cross-tenant`)
    await expect(page.locator("[data-content-state='inaccessible']")).toContainText("different realm")
  })
}

test("applications can be created and moved through their lifecycle", async ({ page }) => {
  await page.goto(`${projectBase}/applications`)

  await expect(page.getByRole("heading", { level: 1, name: "Applications", exact: true })).toBeVisible()
  // The project context strip names the project the applications belong to.
  await expect(page.getByRole("heading", { name: "Acme Portal", exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("Acme Web Portal", { exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("Acme Legacy Intranet", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Add application", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Application name", { exact: true }).fill("E2E Application")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  const row = page.getByRole("row", { name: /E2E Application/ })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "Deactivate", exact: true }).click()
  await expect(row.getByRole("button", { name: "Activate", exact: true })).toBeVisible()
})

test("project roles and cross-organization grants are managed together", async ({ page }) => {
  await page.goto(`${projectBase}/roles-grants`)

  await expect(page.getByRole("heading", { name: "Project roles", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Organization grants", exact: true })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Administrator", exact: true })).toBeVisible()
  // A grant to another organization is presented as cross-organization access.
  await expect(page.getByRole("table").getByText("Globex Corporation", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Create role", exact: true }).click()
  const roleDialog = page.getByRole("dialog")
  await roleDialog.getByLabel("Role key", { exact: true }).fill("auditor")
  await roleDialog.getByLabel("Display name", { exact: true }).fill("Auditor")
  await roleDialog.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("cell", { name: "Auditor", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Grant organization access", exact: true }).click()
  const grantDialog = page.getByRole("dialog")
  await grantDialog.getByRole("checkbox").first().check()
  await grantDialog.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page).not.toHaveURL(/dialog=/)
})

test("effective access shows evaluated roles and the read-only permission catalogue", async ({ page }) => {
  await page.goto(`${projectBase}/effective-access`)

  await expect(page.getByRole("heading", { level: 1, name: "Effective access", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Effective project roles", exact: true })).toBeVisible()
  await expect(page.getByText("admin", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Fixed roles and permissions", exact: true })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Realm administrator", exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("project.grant.write", { exact: false }).first()).toBeVisible()
})

test("project settings edit and lifecycle changes are confirmed", async ({ page }) => {
  await page.goto(projectBase)

  await expect(page.getByRole("heading", { name: "Acme Portal", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { level: 2, name: "Project settings", exact: true })).toBeVisible()

  await page.getByLabel("Project name", { exact: true }).fill("Acme Portal Renamed")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("Acme Portal Renamed")

  await page.getByRole("button", { name: "Deactivate", exact: true }).click()
  await expect(page.getByRole("button", { name: "Activate", exact: true })).toBeVisible()
})

test("project destinations are reachable from the demo directory", async ({ page }) => {
  await page.goto("/demo/admin")

  const group = page.getByLabel("Projects and authorization")
  await expect(group.getByRole("heading", { name: "Projects and authorization", exact: true })).toBeVisible()
  for (const title of ["Project directory", "Applications", "Roles and grants", "Effective access"]) {
    await expect(group.getByRole("heading", { name: title, exact: true })).toBeVisible()
  }
})
