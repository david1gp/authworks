import * as v from "valibot"
import { externalIdentityProviderTypeSchema } from "../../externalIdentities/public/externalIdentityProviderTypeSchema.js"
import { organizationRolesSchema } from "../../organizations/public/organizationRolesSchema.js"
import { sessionAssuranceSchema } from "../../sessions/public/sessionAssuranceSchema.js"
import { userProfileSchema } from "./userProfileSchema.js"
import { userStateSchema } from "./userStateSchema.js"

const userExportEmailSchema = v.strictObject({
  address: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  primary: v.boolean(),
  verified: v.boolean(),
})

const userExportPhoneSchema = v.strictObject({
  number: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
  verified: v.boolean(),
})

const userExportMembershipSchema = v.strictObject({
  organizationId: v.pipe(v.string(), v.minLength(1)),
  organizationName: v.pipe(v.string(), v.minLength(1)),
  roles: organizationRolesSchema,
})

const userExportExternalIdentitySchema = v.strictObject({
  displayName: v.nullable(v.pipe(v.string(), v.maxLength(512))),
  providerId: v.pipe(v.string(), v.minLength(1)),
  providerType: externalIdentityProviderTypeSchema,
})

const userExportPasskeySchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  lastUsedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  nickname: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

const userExportMfaSchema = v.strictObject({
  emailOtp: v.boolean(),
  passkeyCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  password: v.boolean(),
  recoveryCodesAvailable: v.boolean(),
  totpEnrolled: v.boolean(),
})

const userExportSessionSchema = v.strictObject({
  assurance: sessionAssuranceSchema,
  countryCode: v.nullable(v.pipe(v.string(), v.maxLength(16))),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  current: v.boolean(),
  lastUsedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  region: v.nullable(v.pipe(v.string(), v.maxLength(128))),
})

const userExportConsentSchema = v.strictObject({
  clientId: v.pipe(v.string(), v.minLength(1)),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  scopes: v.array(v.pipe(v.string(), v.minLength(1))),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export const userExportResponseSchema = v.strictObject({
  consents: v.array(userExportConsentSchema),
  emails: v.array(userExportEmailSchema),
  externalIdentities: v.array(userExportExternalIdentitySchema),
  memberships: v.array(userExportMembershipSchema),
  mfa: userExportMfaSchema,
  passkeys: v.array(userExportPasskeySchema),
  phone: v.nullable(userExportPhoneSchema),
  profile: userProfileSchema,
  sessions: v.array(userExportSessionSchema),
  state: userStateSchema,
  userId: v.pipe(v.string(), v.minLength(1)),
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type UserExportResponse = v.InferOutput<typeof userExportResponseSchema>
