import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import type { ProductionRouteGuardRequirement } from "./productionRouteGuardRequirement.js"

type ProductionRouteFeature = "account" | "admin" | "login" | "oidc" | "organizations"
type ProductionFeatureContractFeature =
  | "account"
  | "authorization"
  | "email-otp"
  | "events"
  | "external-identities"
  | "impersonation"
  | "machine-users"
  | "mfa"
  | "oidc"
  | "organizations"
  | "passkeys"
  | "passwords"
  | "projects"
  | "realms"
  | "sessions"
  | "users"
type ProductionFeatureContract = `${ProductionFeatureContractFeature}.${string}`

export type ProductionRouteContract = {
  readonly path: `/${string}`
  readonly feature: ProductionRouteFeature
  readonly guard: ProductionRouteGuardRequirement
  readonly screens: readonly {
    readonly key: string
    readonly path: `/${string}`
    readonly title: MessageKey
    readonly contracts: readonly ProductionFeatureContract[]
    readonly guard?: ProductionRouteGuardRequirement
  }[]
}
