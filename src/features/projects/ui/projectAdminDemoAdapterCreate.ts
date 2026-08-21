import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { authorizationFixedRoleDefinitions } from "../../authorization/domain/authorizationFixedRoleDefinitions.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoAdminOrganizations } from "../../demo/demoAdminOrganizations.js"
import { demoAdminProjectApplications } from "../../demo/demoAdminProjectApplications.js"
import { demoAdminProjectGrants } from "../../demo/demoAdminProjectGrants.js"
import { demoAdminProjectRoles } from "../../demo/demoAdminProjectRoles.js"
import { demoAdminProjects } from "../../demo/demoAdminProjects.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import type { ProjectRole } from "../public/projectRoleSchema.js"
import type { Project } from "../public/projectSchema.js"
import type { ProjectAdminAdapter } from "./projectAdminAdapter.js"

const neverResolves = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)

/**
 * Fixture-backed adapter. It performs no network access and derives every
 * success, empty, loading, error, denied, and cross-tenant response from the
 * URL-selected fixture state so each demo destination is deterministic.
 */
export function projectAdminDemoAdapterCreate(fixtureState: () => DemoFixtureState): ProjectAdminAdapter {
  const projects = [...demoAdminProjects]
  const applications = [...demoAdminProjectApplications]
  const grants = [...demoAdminProjectGrants]
  const roles = [...demoAdminProjectRoles]
  const timestamp = 1_755_782_400_000

  const gate = <T>(value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    if (state === "error")
      return Promise.resolve(
        resultErrorCodedCreate("projectAdminDemo", "The deterministic project fixture failed.", "projects.read-failed"),
      )
    if (state === "permission-denied")
      return Promise.resolve(
        resultErrorCodedCreate(
          "projectAdminDemo",
          "You do not have permission to perform this action.",
          "projects.forbidden",
        ),
      )
    if (state === "cross-tenant")
      return Promise.resolve(
        resultErrorCodedCreate(
          "projectAdminDemo",
          "This resource belongs to a different realm.",
          "projects.tenant-mismatch",
        ),
      )
    return Promise.resolve(value())
  }
  const collection = <T>(items: readonly T[]) =>
    gate(() => resultCreate({ items: fixtureState() === "empty" ? [] : [...items] }))

  return {
    applicationCreate: (projectId, input) =>
      gate(() => {
        const application: ProjectApplication = {
          applicationType: input.applicationType,
          createdAt: timestamp,
          id: demoResourceIdGenerate(),
          realmId: demoRealmId,
          name: input.name,
          projectId,
          status: "active",
          updatedAt: timestamp,
        }
        applications.push(application)
        return resultCreate(application)
      }),
    applicationLifecycleSet: (_projectId, applicationId, input) =>
      gate(() => {
        const index = applications.findIndex((item) => item.id === applicationId)
        const existing = applications[index]
        if (existing === undefined)
          return resultErrorCodedCreate("projectAdminDemo", "The application was not found.", "projects.not-found")
        const updated = { ...existing, status: input.status, updatedAt: timestamp }
        applications[index] = updated
        return resultCreate(updated)
      }),
    applicationList: (projectId) => collection(applications.filter((item) => item.projectId === projectId)),
    applicationUpdate: (_projectId, applicationId, input) =>
      gate(() => {
        const index = applications.findIndex((item) => item.id === applicationId)
        const existing = applications[index]
        if (existing === undefined)
          return resultErrorCodedCreate("projectAdminDemo", "The application was not found.", "projects.not-found")
        const updated = { ...existing, name: input.name ?? existing.name, updatedAt: timestamp }
        applications[index] = updated
        return resultCreate(updated)
      }),
    grantCreate: (projectId, input) =>
      gate(() => {
        const project = projects.find((item) => item.id === projectId)
        const grant: ProjectGrant = {
          createdAt: timestamp,
          grantedOrganizationId: input.grantedOrganizationId,
          id: demoResourceIdGenerate(),
          realmId: demoRealmId,
          organizationId: project?.organizationId ?? demoAdminOrganizations[0]?.id ?? demoRealmId,
          projectId,
          roleKeys: [...input.roleKeys],
          status: "active",
          updatedAt: timestamp,
        }
        grants.push(grant)
        return resultCreate(grant)
      }),
    grantDelete: (_projectId, grantId) =>
      gate(() => {
        const index = grants.findIndex((item) => item.id === grantId)
        if (index >= 0) grants.splice(index, 1)
        return resultCreate({ deleted: true } as const)
      }),
    grantLifecycleSet: (_projectId, grantId, input) =>
      gate(() => {
        const index = grants.findIndex((item) => item.id === grantId)
        const existing = grants[index]
        if (existing === undefined)
          return resultErrorCodedCreate("projectAdminDemo", "The grant was not found.", "projects.not-found")
        const updated = { ...existing, status: input.status, updatedAt: timestamp }
        grants[index] = updated
        return resultCreate(updated)
      }),
    grantList: (projectId) => collection(grants.filter((item) => item.projectId === projectId)),
    grantUpdate: (_projectId, grantId, input) =>
      gate(() => {
        const index = grants.findIndex((item) => item.id === grantId)
        const existing = grants[index]
        if (existing === undefined)
          return resultErrorCodedCreate("projectAdminDemo", "The grant was not found.", "projects.not-found")
        const updated = {
          ...existing,
          grantedOrganizationId: input.grantedOrganizationId ?? existing.grantedOrganizationId,
          roleKeys: input.roleKeys === undefined ? existing.roleKeys : [...input.roleKeys],
          updatedAt: timestamp,
        }
        grants[index] = updated
        return resultCreate(updated)
      }),
    organizations: () =>
      gate(() => resultCreate(demoAdminOrganizations.map((item) => ({ id: item.id, name: item.name })))),
    permissionRoles: () => authorizationFixedRoleDefinitions,
    projectAccessCheck: (projectId) =>
      gate(() =>
        resultCreate({
          grantedOrganizationId: demoAdminOrganizations[1]?.id,
          projectId,
          roleKeys: fixtureState() === "empty" ? [] : ["admin", "reader"],
        }),
      ),
    projectCreate: (input) =>
      gate(() => {
        const project: Project = {
          authorizationRequired: input.authorizationRequired ?? false,
          createdAt: timestamp,
          id: demoResourceIdGenerate(),
          realmId: demoRealmId,
          name: input.name,
          organizationId: input.organizationId,
          projectAccessRequired: input.projectAccessRequired ?? false,
          status: "active",
          updatedAt: timestamp,
        }
        projects.push(project)
        return resultCreate(project)
      }),
    projectDelete: (projectId) =>
      gate(() => {
        const index = projects.findIndex((item) => item.id === projectId)
        if (index >= 0) projects.splice(index, 1)
        return resultCreate({ deleted: true } as const)
      }),
    projectGet: (projectId) =>
      gate(() => {
        const project = projects.find((item) => item.id === projectId)
        if (project === undefined)
          return resultErrorCodedCreate("projectAdminDemo", "The project was not found.", "projects.not-found")
        return resultCreate(project)
      }),
    projectLifecycleSet: (projectId, input) =>
      gate(() => {
        const index = projects.findIndex((item) => item.id === projectId)
        const existing = projects[index]
        if (existing === undefined)
          return resultErrorCodedCreate("projectAdminDemo", "The project was not found.", "projects.not-found")
        const updated = { ...existing, status: input.status, updatedAt: timestamp }
        projects[index] = updated
        return resultCreate(updated)
      }),
    projectList: () => collection(projects),
    projectUpdate: (projectId, input) =>
      gate(() => {
        const index = projects.findIndex((item) => item.id === projectId)
        const existing = projects[index]
        if (existing === undefined)
          return resultErrorCodedCreate("projectAdminDemo", "The project was not found.", "projects.not-found")
        const updated = {
          ...existing,
          authorizationRequired: input.authorizationRequired ?? existing.authorizationRequired,
          name: input.name ?? existing.name,
          projectAccessRequired: input.projectAccessRequired ?? existing.projectAccessRequired,
          updatedAt: timestamp,
        }
        projects[index] = updated
        return resultCreate(updated)
      }),
    roleCreate: (projectId, input) =>
      gate(() => {
        const role: ProjectRole = {
          createdAt: timestamp,
          displayName: input.displayName,
          ...(input.group === undefined ? {} : { group: input.group }),
          id: demoResourceIdGenerate(),
          realmId: demoRealmId,
          key: input.key,
          projectId,
          updatedAt: timestamp,
        }
        roles.push(role)
        return resultCreate(role)
      }),
    roleDelete: (_projectId, roleId) =>
      gate(() => {
        const index = roles.findIndex((item) => item.id === roleId)
        if (index >= 0) roles.splice(index, 1)
        return resultCreate({ deleted: true } as const)
      }),
    roleList: (projectId) => collection(roles.filter((item) => item.projectId === projectId)),
    roleUpdate: (_projectId, roleId, input) =>
      gate(() => {
        const index = roles.findIndex((item) => item.id === roleId)
        const existing = roles[index]
        if (existing === undefined)
          return resultErrorCodedCreate("projectAdminDemo", "The role was not found.", "projects.not-found")
        const group = input.group === null ? undefined : (input.group ?? existing.group)
        const updated: ProjectRole = {
          ...existing,
          displayName: input.displayName ?? existing.displayName,
          ...(group === undefined ? {} : { group }),
          updatedAt: timestamp,
        }
        if (group === undefined) delete (updated as { group?: string }).group
        roles[index] = updated
        return resultCreate(updated)
      }),
  }
}
