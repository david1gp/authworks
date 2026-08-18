import { and, asc, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
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
        if (row === undefined)
          return resultErrorCodedCreate("projectCreate", "The project could not be created.", "projects.write-failed")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate("projectCreate", "The project could not be created.", "projects.write-failed")
      }
    },

    projectDelete(projectId: string): Result<ProjectRow | null> {
      try {
        return resultCreate(
          database.delete(projectTable).where(eq(projectTable.id, projectId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("projectDelete", "The project could not be deleted.", "projects.write-failed")
      }
    },

    projectGet(projectId: string): Result<ProjectRow | null> {
      try {
        return resultCreate(database.select().from(projectTable).where(eq(projectTable.id, projectId)).get() ?? null)
      } catch (_error) {
        return resultErrorCodedCreate("projectGet", "The project could not be read.", "projects.read-failed")
      }
    },

    projectList(realmId: string): Result<ProjectRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectTable)
            .where(eq(projectTable.realmId, realmId))
            .orderBy(asc(projectTable.createdAt), asc(projectTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate("projectList", "The projects could not be read.", "projects.read-failed")
      }
    },

    projectUpdate(projectId: string, input: ProjectUpdate): Result<ProjectRow | null> {
      try {
        return resultCreate(
          database.update(projectTable).set(input).where(eq(projectTable.id, projectId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("projectUpdate", "The project could not be updated.", "projects.write-failed")
      }
    },

    projectApplicationCreate(input: ProjectApplicationInsert): Result<ProjectApplicationRow> {
      try {
        const row = database.insert(projectApplicationTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "projectApplicationCreate",
            "The application could not be created.",
            "projects.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectApplicationCreate",
          "The application could not be created.",
          "projects.write-failed",
        )
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
        return resultErrorCodedCreate(
          "projectApplicationDelete",
          "The application could not be deleted.",
          "projects.write-failed",
        )
      }
    },

    projectApplicationGet(applicationId: string): Result<ProjectApplicationRow | null> {
      try {
        return resultCreate(
          database.select().from(projectApplicationTable).where(eq(projectApplicationTable.id, applicationId)).get() ??
            null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectApplicationGet",
          "The application could not be read.",
          "projects.read-failed",
        )
      }
    },

    projectApplicationList(projectId: string): Result<ProjectApplicationRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectApplicationTable)
            .where(eq(projectApplicationTable.projectId, projectId))
            .orderBy(asc(projectApplicationTable.createdAt), asc(projectApplicationTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectApplicationList",
          "The applications could not be read.",
          "projects.read-failed",
        )
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
        return resultErrorCodedCreate(
          "projectApplicationUpdate",
          "The application could not be updated.",
          "projects.write-failed",
        )
      }
    },

    projectGrantCreate(input: ProjectGrantInsert): Result<ProjectGrantRow> {
      try {
        const row = database.insert(projectGrantTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "projectGrantCreate",
            "The project grant could not be created.",
            "projects.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectGrantCreate",
          "The project grant could not be created.",
          "projects.write-failed",
        )
      }
    },

    projectGrantDelete(grantId: string): Result<ProjectGrantRow | null> {
      try {
        return resultCreate(
          database.delete(projectGrantTable).where(eq(projectGrantTable.id, grantId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectGrantDelete",
          "The project grant could not be deleted.",
          "projects.write-failed",
        )
      }
    },

    projectGrantGet(grantId: string): Result<ProjectGrantRow | null> {
      try {
        return resultCreate(
          database.select().from(projectGrantTable).where(eq(projectGrantTable.id, grantId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("projectGrantGet", "The project grant could not be read.", "projects.read-failed")
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
        return resultErrorCodedCreate(
          "projectGrantGetByProjectOrganization",
          "The project grant could not be read.",
          "projects.read-failed",
        )
      }
    },

    projectGrantList(projectId: string): Result<ProjectGrantRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectGrantTable)
            .where(eq(projectGrantTable.projectId, projectId))
            .orderBy(asc(projectGrantTable.createdAt), asc(projectGrantTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectGrantList",
          "The project grants could not be read.",
          "projects.read-failed",
        )
      }
    },

    projectGrantUpdate(grantId: string, input: ProjectGrantUpdate): Result<ProjectGrantRow | null> {
      try {
        return resultCreate(
          database.update(projectGrantTable).set(input).where(eq(projectGrantTable.id, grantId)).returning().get() ??
            null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectGrantUpdate",
          "The project grant could not be updated.",
          "projects.write-failed",
        )
      }
    },

    projectRoleCreate(input: ProjectRoleInsert): Result<ProjectRoleRow> {
      try {
        const row = database.insert(projectRoleTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "projectRoleCreate",
            "The project role could not be created.",
            "projects.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectRoleCreate",
          "The project role could not be created.",
          "projects.write-failed",
        )
      }
    },

    projectRoleDelete(roleId: string): Result<ProjectRoleRow | null> {
      try {
        return resultCreate(
          database.delete(projectRoleTable).where(eq(projectRoleTable.id, roleId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectRoleDelete",
          "The project role could not be removed.",
          "projects.write-failed",
        )
      }
    },

    projectRoleGet(roleId: string): Result<ProjectRoleRow | null> {
      try {
        return resultCreate(
          database.select().from(projectRoleTable).where(eq(projectRoleTable.id, roleId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate("projectRoleGet", "The project role could not be read.", "projects.read-failed")
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
        return resultErrorCodedCreate(
          "projectRoleGetByProjectKey",
          "The project role could not be read.",
          "projects.read-failed",
        )
      }
    },

    projectRoleList(projectId: string): Result<ProjectRoleRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(projectRoleTable)
            .where(eq(projectRoleTable.projectId, projectId))
            .orderBy(asc(projectRoleTable.createdAt), asc(projectRoleTable.id))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate("projectRoleList", "The project roles could not be read.", "projects.read-failed")
      }
    },

    projectRoleUpdate(roleId: string, input: ProjectRoleUpdate): Result<ProjectRoleRow | null> {
      try {
        return resultCreate(
          database.update(projectRoleTable).set(input).where(eq(projectRoleTable.id, roleId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "projectRoleUpdate",
          "The project role could not be updated.",
          "projects.write-failed",
        )
      }
    },
  }
}
