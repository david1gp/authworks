import { expect, test } from "bun:test"
import type { AccountEffectiveAccessGroup } from "../../src/features/account/public/accountEffectiveAccessGroupSchema.js"
import { accountOrganizationPanelStateCreate } from "../../src/features/account/ui/accountOrganizationPanelStateCreate.js"
import { accountOrganizationSelectorModeGet } from "../../src/features/account/ui/accountOrganizationSelectorModeGet.js"
import { accountOrganizationSelectorStateCreate } from "../../src/features/account/ui/accountOrganizationSelectorStateCreate.js"
import { accountOrganizationTabIndexResolve } from "../../src/features/account/ui/accountOrganizationTabIndexResolve.js"
import type { OrganizationMe } from "../../src/features/organizations/public/organizationMeSchema.js"

const organizationAccess = (id: string): OrganizationMe => ({
  membership: {
    createdAt: 1,
    id: `membership-${id}`,
    organizationId: id,
    realmId: "realm-1",
    roles: ["member"],
    updatedAt: 1,
    userId: "user-1",
  },
  organization: {
    createdAt: 1,
    id,
    name: id,
    realmId: "realm-1",
    status: "active" as const,
    updatedAt: 1,
  },
})

const group = (): AccountEffectiveAccessGroup => ({
  entries: [
    {
      id: "organization:alpha",
      organization: organizationAccess("alpha"),
      permissions: ["organization.switch", "organization.read"],
      roleKeys: ["member"],
      source: "membership",
    },
    {
      id: "project:portal",
      organization: organizationAccess("alpha"),
      permissions: ["project.read"],
      project: {
        authorizationRequired: true,
        createdAt: 1,
        id: "portal",
        name: "Portal",
        organizationId: "alpha",
        projectAccessRequired: true,
        realmId: "realm-1",
        status: "active",
        updatedAt: 1,
      },
      roleKeys: ["viewer"],
      source: "project-owner",
    },
  ],
  organization: organizationAccess("alpha").organization,
})

test("organization selector keeps tabs up to eight memberships and falls back to a native select above", () => {
  expect(accountOrganizationSelectorModeGet(1)).toBe("tabs")
  expect(accountOrganizationSelectorModeGet(8)).toBe("tabs")
  expect(accountOrganizationSelectorModeGet(9)).toBe("select")
})

test("organization tab keyboard navigation wraps with arrows and jumps with Home and End", () => {
  expect(accountOrganizationTabIndexResolve({ count: 3, index: 0, key: "ArrowLeft" })).toBe(2)
  expect(accountOrganizationTabIndexResolve({ count: 3, index: 2, key: "ArrowRight" })).toBe(0)
  expect(accountOrganizationTabIndexResolve({ count: 3, index: 2, key: "Home" })).toBe(0)
  expect(accountOrganizationTabIndexResolve({ count: 3, index: 0, key: "End" })).toBe(2)
  expect(accountOrganizationTabIndexResolve({ count: 3, index: 0, key: "a" })).toBeUndefined()
  expect(accountOrganizationTabIndexResolve({ count: 0, index: 0, key: "ArrowRight" })).toBeUndefined()
})

test("organization selector keyboard interaction moves focus and keeps viewed selection separate from active context", () => {
  let viewedOrganizationId = "alpha"
  let selectedOrganizationId: string | undefined
  let prevented = false
  let focused = false
  const state = accountOrganizationSelectorStateCreate({
    activeOrganizationId: () => "alpha",
    onSelect: (organizationId) => {
      selectedOrganizationId = organizationId
      viewedOrganizationId = organizationId
    },
    organizations: () => [organizationAccess("alpha"), organizationAccess("beta"), organizationAccess("gamma")],
    viewedOrganizationId: () => viewedOrganizationId,
  })
  state.tabRefSet("beta", { focus: () => (focused = true) } as unknown as HTMLButtonElement)

  state.tabKeyDown({
    key: "ArrowRight",
    preventDefault: () => (prevented = true),
  } as unknown as KeyboardEvent)

  expect(prevented).toBe(true)
  expect(focused).toBe(true)
  expect(selectedOrganizationId).toBe("beta")
  expect(state.selected("beta")).toBe(true)
  expect(state.tabIndexGet("beta")).toBe(0)
  expect(state.tabIndexGet("alpha")).toBe(-1)
  expect(state.valueText("alpha")).toBe("alpha (Active organization)")

  state.tabKeyDown({ key: "Escape", preventDefault: () => (prevented = true) } as unknown as KeyboardEvent)
  expect(selectedOrganizationId).toBe("beta")
})

test("organization panel separates organization permissions from accessible project entries", () => {
  const state = accountOrganizationPanelStateCreate({ group: () => group(), organizationId: () => "alpha" })

  expect(state.organizationPermissions()).toEqual(["organization.read", "organization.switch"])
  expect(state.projectEntries().map((entry) => entry.project?.id)).toEqual(["portal"])
  expect(state.empty()).toBe(false)
  expect(state.tabId("access-panel")).toBe("access-panel-tab-alpha")
})

test("organization selector filters grouped access to the viewed organization", () => {
  const alpha = organizationAccess("alpha")
  const beta = organizationAccess("beta")
  const groups: AccountEffectiveAccessGroup[] = [
    {
      entries: [
        {
          id: "project:alpha",
          organization: alpha,
          permissions: ["project.read"],
          project: {
            authorizationRequired: true,
            createdAt: 1,
            id: "alpha-project",
            name: "Alpha project",
            organizationId: "alpha",
            projectAccessRequired: true,
            realmId: "realm-1",
            status: "active",
            updatedAt: 1,
          },
          roleKeys: ["member"],
          source: "project-owner",
        },
      ],
      organization: alpha.organization,
    },
    {
      entries: [
        {
          id: "organization:beta",
          organization: beta,
          permissions: ["organization.read"],
          roleKeys: ["member"],
          source: "membership",
        },
      ],
      organization: beta.organization,
    },
  ]
  const state = accountOrganizationPanelStateCreate({
    group: () => groups.find((group) => group.organization.id === "alpha"),
    organizationId: () => "alpha",
  })

  expect(state.projectEntries().map((entry) => entry.organization.organization.id)).toEqual(["alpha"])
  expect(state.projectEntries().map((entry) => entry.project?.id)).toEqual(["alpha-project"])
  expect(state.organizationPermissions()).toEqual([])
  expect(groups.find((group) => group.organization.id === "beta")?.entries).toHaveLength(1)
})

test("organization panel reports an empty selection when no access group exists", () => {
  const state = accountOrganizationPanelStateCreate({ group: () => undefined, organizationId: () => "alpha" })

  expect(state.empty()).toBe(true)
  expect(state.organizationPermissions()).toEqual([])
})
