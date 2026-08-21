import { expect, test } from "bun:test"
import * as authorization from "../src/outputs/library/authorization.js"
import * as email from "../src/outputs/library/email.js"
import * as emailOtp from "../src/outputs/library/emailOtp.js"
import * as events from "../src/outputs/library/events.js"
import * as externalIdentities from "../src/outputs/library/externalIdentities.js"
import * as impersonation from "../src/outputs/library/impersonation.js"
import * as machineUsers from "../src/outputs/library/machineUsers.js"
import * as mfa from "../src/outputs/library/mfa.js"
import * as oidc from "../src/outputs/library/oidc.js"
import * as organizations from "../src/outputs/library/organizations.js"
import * as passkeys from "../src/outputs/library/passkeys.js"
import * as passwords from "../src/outputs/library/passwords.js"
import * as projects from "../src/outputs/library/projects.js"
import * as realms from "../src/outputs/library/realms.js"
import * as sessions from "../src/outputs/library/sessions.js"
import * as users from "../src/outputs/library/users.js"
import type { HttpGetOptions, HttpGetResult } from "../src/outputs/library.js"

test("root library publishes HTTP GET contracts", () => {
  const options: HttpGetOptions = { ifModifiedSince: new Date() }
  const result: HttpGetResult<{ id: string }> = {
    success: true,
    status: "current",
    data: { id: "project-1" },
  }

  expect(options.ifModifiedSince).toBeInstanceOf(Date)
  expect(result.success).toBe(true)
  expect(result.status).toBe("current")
})

test("every completed feature has a public library subpath and client", () => {
  expect(authorization.authorizationActorContextSchema).toBeDefined()
  expect(email.emailGeneratorApiClientCreate).toBeFunction()
  expect(emailOtp.emailOtpApiClientCreate).toBeFunction()
  expect(events.eventApiClientCreate).toBeFunction()
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
  expect(passwords.passwordMeChangeRequestSchema).toBeDefined()
  expect(passwords.passwordMeChangeResponseSchema).toBeDefined()
  expect(projects.projectDeleteResponseSchema).toBeDefined()
  expect(sessions.sessionMeDeviceMetadataSchema).toBeDefined()
  expect(sessions.sessionMeListResponseSchema).toBeDefined()
  expect(sessions.sessionMeSchema).toBeDefined()
  expect(users.userAuthenticationMethodsSchema).toBeDefined()
})

test("every API client publishes its complete method set", () => {
  const options = { baseUrl: "https://identity.example.test" }
  expect(Object.keys(realms.realmApiClientCreate(options))).toEqual([
    "realmBootstrapAdminCreate",
    "realmCreate",
    "realmGet",
    "realmList",
    "realmTenantGet",
    "realmTenantUpdate",
    "realmUpdate",
  ])
  expect(Object.keys(organizations.organizationApiClientCreate(options))).toHaveLength(57)
  expect(Object.keys(users.userApiClientCreate(options))).toEqual([
    "userCreate",
    "userGet",
    "userList",
    "userMeGet",
    "userMeAuthenticationMethodsGet",
    "userMeProfileUpdate",
    "userProfileUpdate",
    "userLifecycleSet",
    "userEmailVerificationSet",
    "userDelete",
    "userTenantList",
    "userTenantGet",
    "userTenantCreate",
    "userTenantProfileUpdate",
    "userTenantLifecycleSet",
    "userTenantVerificationSet",
    "userTenantDelete",
    "userMeDelete",
  ])
  expect(Object.keys(passwords.passwordApiClientCreate(options))).toEqual([
    "passwordRegister",
    "passwordLogin",
    "passwordEmailVerify",
    "passwordRecoveryRequest",
    "passwordRecoveryComplete",
    "passwordChange",
    "passwordMeChange",
    "passwordPolicyGet",
    "passwordPolicyTenantGet",
    "passwordPolicyTenantSet",
    "passwordPolicySet",
  ])
  expect(Object.keys(email.emailGeneratorApiClientCreate(options))).toHaveLength(4)
  expect(Object.keys(sessions.sessionApiClientCreate(options))).toEqual([
    "sessionBootstrapAdminSignIn",
    "sessionCurrent",
    "sessionList",
    "sessionMeList",
    "sessionRecentList",
    "sessionRotate",
    "sessionRevoke",
    "sessionMeRevoke",
    "sessionRevokeAll",
    "sessionMeRevokeAll",
  ])
  expect(Object.keys(emailOtp.emailOtpApiClientCreate(options))).toHaveLength(2)
  expect(Object.keys(events.eventApiClientCreate(options))).toHaveLength(2)
  expect(Object.keys(externalIdentities.externalIdentityApiClientCreate(options))).toHaveLength(20)
  expect(Object.keys(oidc.oidcApiClientCreate(options))).toHaveLength(38)
  expect(Object.keys(mfa.mfaApiClientCreate(options))).toHaveLength(13)
  expect(Object.keys(passkeys.passkeyApiClientCreate(options))).toHaveLength(10)
  expect(Object.keys(machineUsers.machineUserApiClientCreate(options))).toHaveLength(20)
  expect(Object.keys(projects.projectApiClientCreate(options))).toHaveLength(44)
  expect(Object.keys(impersonation.impersonationApiClientCreate(options))).toHaveLength(2)
})

test("package exports name every library feature boundary", async () => {
  const packageJson = (await Bun.file("package.json").json()) as { exports: Record<string, unknown> }
  const exportKeys = Object.keys(packageJson.exports).sort()
  const expectedKeys = [
    ".",
    "./authorization",
    "./cli",
    "./email",
    "./emailOtp",
    "./events",
    "./externalIdentities",
    "./impersonation",
    "./library",
    "./machineUsers",
    "./mfa",
    "./oidc",
    "./organizations",
    "./package.json",
    "./passkeys",
    "./passwords",
    "./projects",
    "./realms",
    "./server",
    "./sessions",
    "./users",
  ].sort()
  expect(exportKeys).toEqual(expectedKeys)
  expect(exportKeys.some((key) => key.includes("*"))).toBe(false)
})

test("the root library only publishes shared contracts", async () => {
  const root = await import("../src/outputs/library.js")
  expect(Object.keys(root).sort()).toEqual([
    "httpErrorResponseCreate",
    "httpErrorResponseSchema",
    "httpErrorStatusGet",
    "packageName",
    "packageVersion",
    "resultCreate",
    "resultErrorCodedCreate",
    "resultErrorCreate",
    "resultIsOk",
  ])
  expect("userCreate" in root).toBe(false)
  expect("realmList" in root).toBe(false)
})
