import { expect, test } from "bun:test"
import * as authorization from "../src/outputs/library/authorization.js"
import * as emailOtp from "../src/outputs/library/emailOtp.js"
import * as externalIdentities from "../src/outputs/library/externalIdentities.js"
import * as impersonation from "../src/outputs/library/impersonation.js"
import * as realms from "../src/outputs/library/realms.js"
import * as machineUsers from "../src/outputs/library/machineUsers.js"
import * as mfa from "../src/outputs/library/mfa.js"
import * as oidc from "../src/outputs/library/oidc.js"
import * as organizations from "../src/outputs/library/organizations.js"
import * as passkeys from "../src/outputs/library/passkeys.js"
import * as passwords from "../src/outputs/library/passwords.js"
import * as projects from "../src/outputs/library/projects.js"
import * as sessions from "../src/outputs/library/sessions.js"
import * as users from "../src/outputs/library/users.js"

test("every completed feature has a public library subpath and client", () => {
  expect(authorization.authorizationActorContextSchema).toBeDefined()
  expect(emailOtp.emailOtpApiClientCreate).toBeFunction()
  expect(externalIdentities.externalIdentityApiClientCreate).toBeFunction()
  expect(impersonation.impersonationApiClientCreate).toBeFunction()
  expect(realms.realmApiClientCreate).toBeFunction()
  expect(machineUsers.machineUserApiClientCreate).toBeFunction()
  expect(mfa.mfaApiClientCreate).toBeFunction()
  expect(oidc.oidcApiClientCreate).toBeFunction()
  expect(organizations.organizationApiClientCreate).toBeFunction()
  expect(passkeys.passkeyApiClientCreate).toBeFunction()
  expect(passwords.passwordApiClientCreate).toBeFunction()
  expect(projects.projectApiClientCreate).toBeFunction()
  expect(sessions.sessionApiClientCreate).toBeFunction()
  expect(users.userApiClientCreate).toBeFunction()
})

test("public contracts include the previously omitted transport schemas", () => {
  expect(organizations.organizationBrandingThemeSchema).toBeDefined()
  expect(machineUsers.machineApiKeyCreateRequestSchema).toBeDefined()
  expect(machineUsers.machinePersonalAccessTokenCreateRequestSchema).toBeDefined()
  expect(machineUsers.machineProtectedApiResponseSchema).toBeDefined()
  expect(oidc.oidcSigningKeyLifecycleRequestSchema).toBeDefined()
  expect(projects.projectDeleteResponseSchema).toBeDefined()
})

test("every API client publishes its complete method set", () => {
  const options = { baseUrl: "https://identity.example.test" }
  expect(Object.keys(realms.realmApiClientCreate(options))).toEqual([
    "realmBootstrapAdminCreate",
    "realmCreate",
    "realmGet",
    "realmList",
    "realmUpdate",
  ])
  expect(Object.keys(organizations.organizationApiClientCreate(options))).toHaveLength(27)
  expect(Object.keys(users.userApiClientCreate(options))).toHaveLength(7)
  expect(Object.keys(passwords.passwordApiClientCreate(options))).toHaveLength(8)
  expect(Object.keys(sessions.sessionApiClientCreate(options))).toHaveLength(6)
  expect(Object.keys(emailOtp.emailOtpApiClientCreate(options))).toHaveLength(2)
  expect(Object.keys(externalIdentities.externalIdentityApiClientCreate(options))).toHaveLength(11)
  expect(Object.keys(oidc.oidcApiClientCreate(options))).toHaveLength(21)
  expect(Object.keys(mfa.mfaApiClientCreate(options))).toHaveLength(11)
  expect(Object.keys(passkeys.passkeyApiClientCreate(options))).toHaveLength(10)
  expect(Object.keys(machineUsers.machineUserApiClientCreate(options))).toHaveLength(11)
  expect(Object.keys(projects.projectApiClientCreate(options))).toHaveLength(22)
  expect(Object.keys(impersonation.impersonationApiClientCreate(options))).toHaveLength(2)
})

test("package exports name every library feature boundary", async () => {
  const packageJson = (await Bun.file("package.json").json()) as { exports: Record<string, unknown> }
  const exports = packageJson.exports
  expect(exports["./features/*"]).toBeDefined()
  expect(exports["./*"]).toBeDefined()
})
