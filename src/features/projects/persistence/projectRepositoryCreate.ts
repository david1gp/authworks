import { and, asc, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type ProjectApplicationRow, projectApplicationTable } from "./projectApplicationTable.js"
import { type ProjectGrantRow, projectGrantTable } from "./projectGrantTable.js"
import { type ProjectRoleRow, projectRoleTable } from "./projectRoleTable.js"
import { type ProjectRow, projectTable } from "./projectTable.js"

type ProjectInsert = typeof projectTable.$inferInsert
type ProjectUpdate = Partial<ProjectInsert>
type ProjectApplicationInsert = typeof projectApplicationTable.$inferInsert
type ProjectApplicationUpdate = Partial<ProjectApplicationInsert>
type ProjectRoleInsert = typeof projectRoleTable.$inferInsert
type ProjectRoleUpdate = Partial<ProjectRoleInsert>
type ProjectGrantInsert = typeof projectGrantTable.$inferInsert
type ProjectGrantUpdate = Partial<ProjectGrantInsert>

export function projectRepositoryCreate(database: StorageExecutor) {
  return {
    projectCreate(input: ProjectInsert): Result<ProjectRow> {
      try {
        const row = database.insert(projectTable).values(input).returning().get()
        if (row === undefined) return resultErrorCreate("projectCreate", "The project could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("projectCreate", "The project could not be created.")
      }
    },

    projectDelete(projectId: string): Result<ProjectRow | null> {
      try {
        return resultCreate(
          database.delete(projectTable).where(eq(projectTable.id, projectId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectDelete", "The project could not be deleted.")
      }
    },

    projectGet(projectId: string): Result<ProjectRow | null> {
      try {
        return resultCreate(database.select().from(projectTable).where(eq(projectTable.id, projectId)).get() ?? null)
      } catch (_error) {
        return resultErrorCreate("projectGet", "The project could not be read.")
      }
    },

    projectList(instanceId: string): Result<ProjectRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectTable)
            .where(eq(projectTable.instanceId, instanceId))
            .orderBy(asc(projectTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("projectList", "The projects could not be read.")
      }
    },

    projectUpdate(projectId: string, input: ProjectUpdate): Result<ProjectRow | null> {
      try {
        return resultCreate(
          database.update(projectTable).set(input).where(eq(projectTable.id, projectId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectUpdate", "The project could not be updated.")
      }
    },

    projectApplicationCreate(input: ProjectApplicationInsert): Result<ProjectApplicationRow> {
      try {
        const row = database.insert(projectApplicationTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("projectApplicationCreate", "The application could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("projectApplicationCreate", "The application could not be created.")
      }
    },

    projectApplicationDelete(applicationId: string): Result<ProjectApplicationRow | null> {
      try {
        return resultCreate(
          database
            .delete(projectApplicationTable)
            .where(eq(projectApplicationTable.id, applicationId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectApplicationDelete", "The application could not be deleted.")
      }
    },

    projectApplicationGet(applicationId: string): Result<ProjectApplicationRow | null> {
      try {
        return resultCreate(
          database.select().from(projectApplicationTable).where(eq(projectApplicationTable.id, applicationId)).get() ??
            null,
        )
      } catch (_error) {
        return resultErrorCreate("projectApplicationGet", "The application could not be read.")
      }
    },

    projectApplicationList(projectId: string): Result<ProjectApplicationRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectApplicationTable)
            .where(eq(projectApplicationTable.projectId, projectId))
            .orderBy(asc(projectApplicationTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("projectApplicationList", "The applications could not be read.")
      }
    },

    projectApplicationUpdate(
      applicationId: string,
      input: ProjectApplicationUpdate,
    ): Result<ProjectApplicationRow | null> {
      try {
        return resultCreate(
          database
            .update(projectApplicationTable)
            .set(input)
            .where(eq(projectApplicationTable.id, applicationId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectApplicationUpdate", "The application could not be updated.")
      }
    },

    projectGrantCreate(input: ProjectGrantInsert): Result<ProjectGrantRow> {
      try {
        const row = database.insert(projectGrantTable).values(input).returning().get()
        if (row === undefined) return resultErrorCreate("projectGrantCreate", "The project grant could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("projectGrantCreate", "The project grant could not be created.")
      }
    },

    projectGrantDelete(grantId: string): Result<ProjectGrantRow | null> {
      try {
        return resultCreate(
          database.delete(projectGrantTable).where(eq(projectGrantTable.id, grantId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectGrantDelete", "The project grant could not be deleted.")
      }
    },

    projectGrantGet(grantId: string): Result<ProjectGrantRow | null> {
      try {
        return resultCreate(
          database.select().from(projectGrantTable).where(eq(projectGrantTable.id, grantId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectGrantGet", "The project grant could not be read.")
      }
    },

    projectGrantGetByProjectOrganization(
      projectId: string,
      grantedOrganizationId: string,
    ): Result<ProjectGrantRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectGrantTable)
            .where(
              and(
                eq(projectGrantTable.projectId, projectId),
                eq(projectGrantTable.grantedOrganizationId, grantedOrganizationId),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectGrantGetByProjectOrganization", "The project grant could not be read.")
      }
    },

    projectGrantList(projectId: string): Result<ProjectGrantRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectGrantTable)
            .where(eq(projectGrantTable.projectId, projectId))
            .orderBy(asc(projectGrantTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("projectGrantList", "The project grants could not be read.")
      }
    },

    projectGrantUpdate(grantId: string, input: ProjectGrantUpdate): Result<ProjectGrantRow | null> {
      try {
        return resultCreate(
          database.update(projectGrantTable).set(input).where(eq(projectGrantTable.id, grantId)).returning().get() ??
            null,
        )
      } catch (_error) {
        return resultErrorCreate("projectGrantUpdate", "The project grant could not be updated.")
      }
    },

    projectRoleCreate(input: ProjectRoleInsert): Result<ProjectRoleRow> {
      try {
        const row = database.insert(projectRoleTable).values(input).returning().get()
        if (row === undefined) return resultErrorCreate("projectRoleCreate", "The project role could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("projectRoleCreate", "The project role could not be created.")
      }
    },

    projectRoleDelete(roleId: string): Result<ProjectRoleRow | null> {
      try {
        return resultCreate(
          database.delete(projectRoleTable).where(eq(projectRoleTable.id, roleId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectRoleDelete", "The project role could not be removed.")
      }
    },

    projectRoleGet(roleId: string): Result<ProjectRoleRow | null> {
      try {
        return resultCreate(
          database.select().from(projectRoleTable).where(eq(projectRoleTable.id, roleId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectRoleGet", "The project role could not be read.")
      }
    },

    projectRoleGetByProjectKey(projectId: string, key: string): Result<ProjectRoleRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectRoleTable)
            .where(and(eq(projectRoleTable.projectId, projectId), eq(projectRoleTable.key, key)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectRoleGetByProjectKey", "The project role could not be read.")
      }
    },

    projectRoleList(projectId: string): Result<ProjectRoleRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectRoleTable)
            .where(eq(projectRoleTable.projectId, projectId))
            .orderBy(asc(projectRoleTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("projectRoleList", "The project roles could not be read.")
      }
    },

    projectRoleUpdate(roleId: string, input: ProjectRoleUpdate): Result<ProjectRoleRow | null> {
      try {
        return resultCreate(
          database.update(projectRoleTable).set(input).where(eq(projectRoleTable.id, roleId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("projectRoleUpdate", "The project role could not be updated.")
      }
    },
  }
}
