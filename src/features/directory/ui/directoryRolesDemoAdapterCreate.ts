import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { demoAdminOrganizationRoles } from "../../demo/demoAdminOrganizationRoles.js"
import { demoAdminProjectRoles } from "../../demo/demoAdminProjectRoles.js"
import { demoAdminProjects } from "../../demo/demoAdminProjects.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import type { ProjectRole } from "../../projects/public/projectRoleSchema.js"
import type { Project } from "../../projects/public/projectSchema.js"
import type { DirectoryRolesAdapter } from "./directoryRolesAdapter.js"

const neverResolves = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)

const activeOrganizationId = "01900000-0000-7000-8000-000000000011"
const sharedProjectTimestamp = 1_755_782_400_000

const extraProject: Project = {
  authorizationRequired: false,
  createdAt: 1_754_918_400_000,
  id: "01900000-0000-7000-8000-000000000033",
  name: "Northwind API",
  organizationId: activeOrganizationId,
  projectAccessRequired: true,
  realmId: demoRealmId,
  status: "active",
  updatedAt: sharedProjectTimestamp,
}

const extraRoles: ProjectRole[] = [
  {
    createdAt: 1_754_918_400_000,
    displayName: "Editor",
    group: "Operations",
    id: "01900000-0000-7000-8000-000000000044",
    key: "editor",
    projectId: "01900000-0000-7000-8000-000000000031",
    realmId: demoRealmId,
    updatedAt: sharedProjectTimestamp,
  },
  {
    createdAt: 1_754_918_400_000,
    displayName: "Viewer",
    id: "01900000-0000-7000-8000-000000000045",
    key: "viewer",
    projectId: "01900000-0000-7000-8000-000000000032",
    realmId: demoRealmId,
    updatedAt: sharedProjectTimestamp,
  },
  {
    createdAt: 1_755_091_200_000,
    displayName: "Maintainer",
    id: "01900000-0000-7000-8000-000000000046",
    key: "maintainer",
    projectId: extraProject.id,
    realmId: demoRealmId,
    updatedAt: sharedProjectTimestamp,
  },
  {
    createdAt: 1_755_091_200_000,
    displayName: "Deployer",
    group: "Operations",
    id: "01900000-0000-7000-8000-000000000047",
    key: "deployer",
    projectId: extraProject.id,
    realmId: demoRealmId,
    updatedAt: sharedProjectTimestamp,
  },
]

const demoSummary = { roles: { admin: 3, guest: 1, member: 18, owner: 2 }, total: 24 }

/**
 * Fixture-backed adapter: three projects (one shared through another owning
 * organization), two to three roles each, honouring the `?as=` actor only
 * through the view gating — every demo actor may manage owned projects.
 */
export function directoryRolesDemoAdapterCreate(fixtureState: () => DemoFixtureState): DirectoryRolesAdapter {
  const projects = [...demoAdminProjects, extraProject]
  const roles = [...demoAdminProjectRoles, ...extraRoles]

  const gate = <T>(value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    if (state === "error")
      return Promise.resolve(
        resultErrorCodedCreate(
          "directoryRolesDemo",
          "The deterministic roles fixture failed.",
          "directory.read-failed",
        ),
      )
    if (state === "permission-denied")
      return Promise.resolve(
        resultErrorCodedCreate(
          "directoryRolesDemo",
          "You do not have permission to view this administration data.",
          "directory.forbidden",
        ),
      )
    return Promise.resolve(value())
  }

  return {
    organizationRoleList: () => gate(() => resultCreate([...demoAdminOrganizationRoles])),
    projectList: () =>
      gate(() =>
        resultCreate(
          fixtureState() === "empty"
            ? []
            : projects.map((project) => ({
                ...project,
                roleCount: roles.filter((role) => role.projectId === project.id).length,
              })),
        ),
      ),
    projectRoleCreate: (projectId, input) =>
      gate(() => {
        const role: ProjectRole = {
          createdAt: sharedProjectTimestamp,
          ...(input.group === undefined ? {} : { group: input.group }),
          displayName: input.displayName,
          id: demoResourceIdGenerate(),
          key: input.key,
          projectId,
          realmId: demoRealmId,
          updatedAt: sharedProjectTimestamp,
        }
        roles.push(role)
        return resultCreate(role)
      }),
    projectRoleDelete: (_projectId, roleId) =>
      gate(() => {
        const index = roles.findIndex((role) => role.id === roleId)
        if (index >= 0) roles.splice(index, 1)
        return resultCreate({ deleted: true } as const)
      }),
    projectRoleList: (projectId) =>
      gate(() => resultCreate(fixtureState() === "empty" ? [] : roles.filter((role) => role.projectId === projectId))),
    projectRoleUpdate: (_projectId, roleId, input) =>
      gate(() => {
        const index = roles.findIndex((role) => role.id === roleId)
        const existing = roles[index]
        if (existing === undefined)
          return resultErrorCodedCreate("directoryRolesDemo", "The project role was not found.", "projects.not-found")
        const updated: ProjectRole = {
          ...existing,
          displayName: input.displayName ?? existing.displayName,
          ...(input.group === undefined ? {} : { group: input.group ?? undefined }),
          updatedAt: sharedProjectTimestamp,
        }
        roles[index] = updated
        return resultCreate(updated)
      }),
    userSummary: () => gate(() => resultCreate(demoSummary)),
  }
}
