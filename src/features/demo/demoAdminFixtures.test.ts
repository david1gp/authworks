import { describe, expect, test } from "bun:test"
import * as v from "valibot"
import { adminDemoEventFixtures } from "../admin/ui/adminDemoEventFixtures.js"
import { adminDemoRealmFixture } from "../admin/ui/adminDemoRealmFixture.js"
import { adminDemoUserFixtures } from "../admin/ui/adminDemoUserFixtures.js"
import { eventSchema } from "../events/public/eventSchema.js"
import { organizationMembershipSchema } from "../organizations/public/organizationMembershipSchema.js"
import { organizationSchema } from "../organizations/public/organizationSchema.js"
import { projectRoleSchema } from "../projects/public/projectRoleSchema.js"
import { projectSchema } from "../projects/public/projectSchema.js"
import { realmSchema } from "../realms/public/realmSchema.js"
import { userSchema } from "../users/public/userSchema.js"
import { demoAdminMemberships } from "./demoAdminMemberships.js"
import { demoAdminOrganizations } from "./demoAdminOrganizations.js"
import { demoAdminProjectRoles } from "./demoAdminProjectRoles.js"
import { demoAdminProjects } from "./demoAdminProjects.js"
import { demoAdminRedactedEvent } from "./demoAdminRedactedEvent.js"

describe("demo administration fixtures", () => {
  test("parse against the public transport schemas", () => {
    expect(v.safeParse(v.array(organizationSchema), demoAdminOrganizations).success).toBe(true)
    expect(v.safeParse(v.array(organizationMembershipSchema), demoAdminMemberships).success).toBe(true)
    expect(v.safeParse(v.array(userSchema), adminDemoUserFixtures).success).toBe(true)
    expect(v.safeParse(v.array(projectSchema), demoAdminProjects).success).toBe(true)
    expect(v.safeParse(v.array(projectRoleSchema), demoAdminProjectRoles).success).toBe(true)
    expect(v.safeParse(v.array(eventSchema), adminDemoEventFixtures).success).toBe(true)
    expect(v.safeParse(realmSchema, adminDemoRealmFixture).success).toBe(true)
  })

  test("expose a secret-bearing event so the audit view proves browser-side redaction", () => {
    expect(v.safeParse(eventSchema, demoAdminRedactedEvent).success).toBe(true)
    expect(adminDemoEventFixtures).toContain(demoAdminRedactedEvent)
  })
})
