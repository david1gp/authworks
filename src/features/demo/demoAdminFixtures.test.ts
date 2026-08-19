import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { eventSchema } from "../events/public/eventSchema.js"
import { organizationMembershipSchema } from "../organizations/public/organizationMembershipSchema.js"
import { organizationSchema } from "../organizations/public/organizationSchema.js"
import { projectRoleSchema } from "../projects/public/projectRoleSchema.js"
import { projectSchema } from "../projects/public/projectSchema.js"
import { userSchema } from "../users/public/userSchema.js"
import { demoAdminEvents } from "./demoAdminEvents.js"
import { demoAdminMemberships } from "./demoAdminMemberships.js"
import { demoAdminOrganizations } from "./demoAdminOrganizations.js"
import { demoAdminProjectRoles } from "./demoAdminProjectRoles.js"
import { demoAdminProjects } from "./demoAdminProjects.js"
import { demoAdminUsers } from "./demoAdminUsers.js"

describe("demo administration fixtures", () => {
  test("parse against the public transport schemas", () => {
    expect(v.safeParse(v.array(organizationSchema), demoAdminOrganizations).success).toBe(true)
    expect(v.safeParse(v.array(organizationMembershipSchema), demoAdminMemberships).success).toBe(true)
    expect(v.safeParse(v.array(userSchema), demoAdminUsers).success).toBe(true)
    expect(v.safeParse(v.array(projectSchema), demoAdminProjects).success).toBe(true)
    expect(v.safeParse(v.array(projectRoleSchema), demoAdminProjectRoles).success).toBe(true)
    expect(v.safeParse(v.array(eventSchema), demoAdminEvents).success).toBe(true)
  })
})
