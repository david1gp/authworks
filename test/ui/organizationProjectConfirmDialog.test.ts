import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => fn(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_deps: unknown, fn: () => void) => fn,
}))

const [
  { confirmStateCreate },
  { organizationAdminDemoAdapterCreate },
  { organizationAdminPageStateCreate },
  { projectAdminDemoAdapterCreate },
  { projectAdminPageStateCreate },
] = await Promise.all([
  import("../../src/ui/confirm/confirmStateCreate.js"),
  import("../../src/features/organizations/ui/organizationAdminDemoAdapterCreate.js"),
  import("../../src/features/organizations/ui/organizationAdminPageStateCreate.js"),
  import("../../src/features/projects/ui/projectAdminDemoAdapterCreate.js"),
  import("../../src/features/projects/ui/projectAdminPageStateCreate.js"),
])

const organizationId = "01900000-0000-7000-8000-000000000011"
const projectId = "01900000-0000-7000-8000-000000000031"

/** Records which adapter mutations ran so a cancelled prompt can be proven non-destructive. */
const adapterRecord = <T extends object>(adapter: T, calls: string[]): T =>
  new Proxy(adapter, {
    get: (target, property, receiver) => {
      const value = Reflect.get(target, property, receiver)
      if (typeof value !== "function" || typeof property !== "string") return value
      return (...args: unknown[]) => {
        calls.push(property)
        return (value as (...input: unknown[]) => unknown).apply(target, args)
      }
    },
  })

const organizationPageCreate = (confirm: (message: string) => boolean | Promise<boolean>, calls: string[]) =>
  organizationAdminPageStateCreate({
    adapter: adapterRecord(
      organizationAdminDemoAdapterCreate(() => "success"),
      calls,
    ),
    confirm,
    organizationId: () => organizationId,
    screen: () => "organization-detail",
  })

const projectPageCreate = (
  confirm: (request: { readonly message: string }) => boolean | Promise<boolean>,
  calls: string[],
) =>
  projectAdminPageStateCreate({
    adapter: adapterRecord(
      projectAdminDemoAdapterCreate(() => "success"),
      calls,
    ),
    confirm,
    projectId: () => projectId,
    screen: () => "project-detail",
  })

const destructive = (calls: string[]) => calls.filter((name) => !name.endsWith("List") && !name.endsWith("Get"))

describe("organization administration destructive confirmations", () => {
  test("cancelling leaves the lifecycle, domain, member, invitation, and provider untouched", async () => {
    const calls: string[] = []
    const page = organizationPageCreate(() => false, calls)
    calls.length = 0

    await page.organizationLifecycleSet("removed")
    await page.domainRemove("acme.example")
    await page.membershipRemove("membership-1", "user-1")
    await page.invitationRevoke("invitation-1", "rowan@example.com")
    await page.providerDisable("provider-1", "Acme SSO")

    expect(destructive(calls)).toEqual([])
  })

  test("accepting runs exactly the confirmed mutation", async () => {
    const calls: string[] = []
    const page = organizationPageCreate(() => true, calls)
    calls.length = 0

    await page.providerDisable("provider-1", "Acme SSO")

    expect(destructive(calls)).toEqual(["providerDisable"])
  })

  test("the guard waits for the shared prompt and a cancel declines it", async () => {
    const calls: string[] = []
    const confirmState = confirmStateCreate()
    const page = organizationPageCreate(confirmState.confirm, calls)
    calls.length = 0

    const pending = page.membershipRemove("membership-1", "user-1")
    expect(confirmState.open()).toBe(true)
    expect(confirmState.message()).toContain("user-1")
    confirmState.cancel()
    await pending

    expect(destructive(calls)).toEqual([])
    expect(confirmState.open()).toBe(false)
  })

  test("an unwired screen declines rather than destroying silently", async () => {
    const calls: string[] = []
    const page = organizationAdminPageStateCreate({
      adapter: adapterRecord(
        organizationAdminDemoAdapterCreate(() => "success"),
        calls,
      ),
      organizationId: () => organizationId,
      screen: () => "organization-detail",
    })
    calls.length = 0

    await page.organizationLifecycleSet("removed")

    expect(destructive(calls)).toEqual([])
  })
})

describe("project administration destructive confirmations", () => {
  test("cancelling leaves the project, application, role, and grant untouched", async () => {
    const calls: string[] = []
    const page = projectPageCreate(() => false, calls)
    calls.length = 0

    expect(await page.projectDelete(projectId)).toBe(false)
    await page.projectLifecycleSet(projectId, "removed")
    await page.applicationLifecycleSet(projectId, "application-1", "removed")
    await page.roleDelete(projectId, "role-1")
    await page.grantDelete(projectId, "grant-1")

    expect(destructive(calls)).toEqual([])
  })

  test("accepting runs the action, and a non-destructive lifecycle change is never gated", async () => {
    const calls: string[] = []
    const page = projectPageCreate(() => true, calls)
    calls.length = 0

    await page.roleDelete(projectId, "role-1")
    await page.projectLifecycleSet(projectId, "inactive")

    expect(destructive(calls)).toEqual(["roleDelete", "projectLifecycleSet"])
  })

  test("the guard waits for the shared prompt and a cancel declines it", async () => {
    const calls: string[] = []
    const confirmState = confirmStateCreate()
    const page = projectPageCreate(confirmState.confirm, calls)
    calls.length = 0

    const pending = page.grantDelete(projectId, "grant-1")
    expect(confirmState.open()).toBe(true)
    expect(confirmState.message()).toBeString()
    confirmState.cancel()
    await pending

    expect(destructive(calls)).toEqual([])
    expect(confirmState.open()).toBe(false)
  })
})

describe("organization and project confirmation wiring", () => {
  const sourceRead = async (path: string) => await Bun.file(new URL(path, import.meta.url)).text()

  test("both screen views render the shared dialog with the shared administration title", async () => {
    for (const path of [
      "../../src/features/organizations/ui/OrganizationAdminScreenView.tsx",
      "../../src/features/projects/ui/ProjectAdminScreenView.tsx",
    ]) {
      const source = await sourceRead(path)
      expect(source).toContain("ConfirmDialog")
      expect(source).toContain('titleKey="admin.common.confirmTitle"')
    }
  })

  test("no organization or project state falls back to a native prompt or auto-accept", async () => {
    for (const path of [
      "../../src/features/organizations/ui/organizationAdminPageStateCreate.ts",
      "../../src/features/organizations/ui/organizationAdminProductionStateCreate.ts",
      "../../src/features/organizations/ui/organizationAdminDemoStateCreate.ts",
      "../../src/features/projects/ui/projectAdminPageStateCreate.ts",
      "../../src/features/projects/ui/projectAdminScreenStateCreate.ts",
      "../../src/features/projects/ui/projectAdminProductionStateCreate.ts",
      "../../src/features/projects/ui/projectAdminDemoStateCreate.ts",
    ]) {
      const source = await sourceRead(path)
      expect(source, path).not.toContain("window.confirm")
      expect(source, path).not.toContain("confirm: () => true")
    }
  })
})
