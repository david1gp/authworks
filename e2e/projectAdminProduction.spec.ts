import { expect, test } from "@playwright/test"
import { productionAdminSessionBootstrap } from "./productionAdminSessionBootstrap.js"

// Payloads must satisfy the public UUIDv7-shaped resource identifier schema.
const realmId = "018f0000-0000-7000-8000-000000000001"
const projectId = "018f0000-0000-7000-8000-000000000031"
const realmApiPath = new RegExp(`/realms/${realmId}/(?!sessions/current(?:\\?|$))`)

const project = {
  authorizationRequired: true,
  createdAt: 1,
  id: projectId,
  name: "Acme Portal",
  organizationId: "018f0000-0000-7000-8000-000000000011",
  projectAccessRequired: false,
  realmId,
  status: "active",
  updatedAt: 1,
}
const application = {
  applicationType: "oidc",
  createdAt: 1,
  id: "018f0000-0000-7000-8000-000000000051",
  name: "Acme Web Portal",
  projectId,
  realmId,
  status: "active",
  updatedAt: 1,
}
const organizations = [
  { createdAt: 1, id: project.organizationId, name: "Acme Corporation", realmId, status: "active", updatedAt: 1 },
  {
    createdAt: 1,
    id: "018f0000-0000-7000-8000-000000000012",
    name: "Globex Corporation",
    realmId,
    status: "active",
    updatedAt: 1,
  },
]

test.beforeEach(async ({ page }) => {
  await productionAdminSessionBootstrap(page, {
    organizationId: project.organizationId,
    organizationName: organizations[0]?.name ?? "Acme Corporation",
    realmId,
  })
})

test("the production project list reads the realm-scoped tenant API", async ({ page }) => {
  const requested: string[] = []
  await page.route(realmApiPath, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    requested.push(pathname)
    if (pathname.endsWith("/organizations")) return route.fulfill({ json: { items: organizations } })
    if (pathname.endsWith("/projects")) return route.fulfill({ json: { items: [project] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto("/admin/projects")

  await expect(page.getByRole("table").getByText("Acme Portal", { exact: true })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Acme Corporation", exact: true })).toBeVisible()
  expect(requested).toContain(`/realms/${realmId}/projects`)
  // The browser must never reach the operator-only system surface.
  expect(requested.every((pathname) => !pathname.startsWith("/system/"))).toBe(true)
})

test("creating an application sends a CSRF-protected tenant mutation", async ({ page }) => {
  let createHadCsrf = false
  await page.route(realmApiPath, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith("/sessions/csrf")) return route.fulfill({ json: { csrfToken: "csrf-e2e" } })
    if (pathname.endsWith("/organizations")) return route.fulfill({ json: { items: organizations } })
    if (pathname.endsWith(`/projects/${projectId}`)) return route.fulfill({ json: { project } })
    if (pathname.endsWith("/applications") && request.method() === "POST") {
      createHadCsrf = request.headers()["x-csrf-token"] !== undefined
      return route.fulfill({ json: { application: { ...application, name: "Production App" } } })
    }
    if (pathname.endsWith("/applications")) return route.fulfill({ json: { items: [application] } })
    return route.fulfill({ json: { items: [] } })
  })

  await page.goto(`/admin/projects/${projectId}/applications`)
  await expect(page.getByRole("table").getByText("Acme Web Portal", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Add application", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Application name", { exact: true }).fill("Production App")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByRole("table").getByText("Production App", { exact: true })).toBeVisible()
  expect(createHadCsrf).toBe(true)
})

test("permission and tenant failures render distinct inaccessible states", async ({ page }) => {
  await page.route(realmApiPath, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/organizations")) return route.fulfill({ json: { items: organizations } })
    return route.fulfill({
      json: { error: { code: "projects.forbidden", message: "Denied.", op: "projectList", status: 403 } },
      status: 403,
    })
  })
  await page.goto("/admin/projects")
  await expect(page.locator("[data-content-state='inaccessible']")).toContainText("permission")

  await page.route(realmApiPath, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/organizations")) return route.fulfill({ json: { items: organizations } })
    return route.fulfill({
      json: {
        error: { code: "projects.tenant-mismatch", message: "Other realm.", op: "projectGet", status: 404 },
      },
      status: 404,
    })
  })
  await page.goto(`/admin/projects/${projectId}/roles-grants`)
  await expect(page.locator("[data-content-state='inaccessible']")).toContainText("different realm")
})
