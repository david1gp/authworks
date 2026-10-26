import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (fn: () => unknown) => fn(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_dependencies: unknown, fn: () => unknown) => fn,
}))

const { projectAdminListViewStateCreate } = await import("./projectAdminListViewStateCreate.js")

import type { ProjectAdminPageState } from "./projectAdminPageStateCreate.js"

const orgA = "01900000-0000-7000-8000-0000000000a1"
const orgB = "01900000-0000-7000-8000-0000000000b2"

function optionsCreate(activeOrganizationId: () => string | undefined) {
  const page = {
    projectCreate: async () => true,
    projects: () => [],
  } as unknown as ProjectAdminPageState
  return {
    basePath: "/admin",
    createOpen: () => false,
    createOpenSet: (_open: boolean) => undefined,
    organizationId: activeOrganizationId,
    page,
    search: () => "",
    searchSet: (_value: string) => undefined,
    statusFilter: () => "active" as const,
    statusFilterSet: (_value: string) => undefined,
    withActor: (href: string) => href,
  }
}

describe("project administration list ownership", () => {
  test("badges ownership against the active organization, not the first visible one", () => {
    // A realm administrator sees several organizations with another org listed first;
    // the Owned/Shared badge must follow the active organization either way.
    const state = projectAdminListViewStateCreate(optionsCreate(() => orgB))

    expect(state.activeOrganizationId()).toBe(orgB)
    expect(state.activeOrganizationId()).not.toBe(orgA)
  })

  test("tracks the live active organization instead of a snapshot", () => {
    let active: string | undefined = orgA
    const state = projectAdminListViewStateCreate(optionsCreate(() => active))

    expect(state.activeOrganizationId()).toBe(orgA)
    active = orgB
    expect(state.activeOrganizationId()).toBe(orgB)
  })

  test("falls back to shared when no organization is active", () => {
    const state = projectAdminListViewStateCreate(optionsCreate(() => undefined))

    expect(state.activeOrganizationId()).toBeUndefined()
  })
})
