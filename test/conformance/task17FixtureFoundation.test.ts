import { expect, test } from "bun:test"
import { authworksE2eFixtureCreate } from "../../e2e/authworksE2eFixtureCreate.js"

test("task 17 fixture creates the minimum isolated account graph through public clients", async () => {
  const fixtureResult = await authworksE2eFixtureCreate()
  expect(fixtureResult.success).toBe(true)
  if (!fixtureResult.success) return
  const fixture = fixtureResult.data

  try {
    expect(fixture.realm.domain).toBe("e2e.authworks.test")
    expect(fixture.bootstrapAdmin.secret).toHaveLength(43)
    expect(fixture.administrator.userName).toBe("e2e-administrator")
    expect(fixture.member.userName).toBe("e2e-member")
    expect(fixture.machineUser.clientSecret).toHaveLength(43)

    const realm = await fixture.clients.realms.realmGet(fixture.realm.id)
    const users = await fixture.clients.users.userList(fixture.realm.id)
    const organization = await fixture.clients.organizations.organizationGet(fixture.realm.id, fixture.organization.id)
    const memberships = await fixture.clients.organizations.organizationMembershipList(
      fixture.realm.id,
      fixture.organization.id,
    )
    const machineUser = await fixture.clients.machines.machineUserGet(fixture.realm.id, fixture.machineUser.id)
    const project = await fixture.clients.projects.projectGet(fixture.realm.id, fixture.project.id)
    const application = await fixture.clients.projects.projectApplicationGet(
      fixture.realm.id,
      fixture.project.id,
      fixture.application.id,
    )

    expect(realm.success).toBe(true)
    expect(users).toMatchObject({
      success: true,
      data: {
        items: expect.arrayContaining([
          expect.objectContaining({ id: fixture.administrator.id }),
          expect.objectContaining({ id: fixture.member.id }),
        ]),
      },
    })
    expect(organization).toMatchObject({ success: true, data: { organization: { id: fixture.organization.id } } })
    expect(memberships).toMatchObject({
      success: true,
      data: {
        items: expect.arrayContaining([expect.objectContaining({ roles: ["member"], userId: fixture.member.id })]),
      },
    })
    expect(machineUser).toMatchObject({ success: true, data: { machineUser: { id: fixture.machineUser.id } } })
    expect(project).toMatchObject({ success: true, data: { project: { id: fixture.project.id } } })
    expect(application).toMatchObject({ success: true, data: { application: { id: fixture.application.id } } })
  } finally {
    expect((await fixture.close()).success).toBe(true)
  }
})

test("task 17 fixtures are repeatable, parallel-safe, and clean up their isolated directories", async () => {
  const fixtures = await Promise.all([authworksE2eFixtureCreate(), authworksE2eFixtureCreate()])
  expect(fixtures.every((fixture) => fixture.success)).toBe(true)
  if (!fixtures[0]?.success || !fixtures[1]?.success) return

  const first = fixtures[0].data
  const second = fixtures[1].data
  try {
    expect(first.databaseDirectory).not.toBe(second.databaseDirectory)
    expect(first.realm.domain).toBe(second.realm.domain)
    expect(first.realm.id).not.toBe(second.realm.id)
    expect(first.organization.name).toBe("E2E Organization")
    expect(second.organization.name).toBe("E2E Organization")
  } finally {
    expect((await first.close()).success).toBe(true)
    expect((await second.close()).success).toBe(true)
    expect(await Bun.file(first.databaseDirectory).exists()).toBe(false)
    expect(await Bun.file(second.databaseDirectory).exists()).toBe(false)
  }
})
