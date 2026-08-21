import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { adminDemoUserFixtures } from "../../admin/ui/adminDemoUserFixtures.js"
import { demoAdminImpersonationNow } from "../../demo/demoAdminImpersonationNow.js"
import { demoAdminImpersonationSession } from "../../demo/demoAdminImpersonationSession.js"
import { demoAdminOrganizations } from "../../demo/demoAdminOrganizations.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { impersonationAdminUserLabel } from "./impersonationAdminUserLabel.js"
import type { ImpersonationAdminAdapter, ImpersonationAdminSession } from "./impersonationAdminAdapter.js"

const neverResolves = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)

/**
 * Fixture-backed adapter. It performs no network access and derives every eligible, denied,
 * assurance-required, active, expiring, nested-rejected, ended, and error response from the
 * URL-selected fixture state, so each `/demo/admin/**` destination is deterministic.
 *
 * No session credential is ever produced here, so no demo screen can suggest a usable token.
 */
export function impersonationAdminDemoAdapterCreate(fixtureState: () => DemoFixtureState): ImpersonationAdminAdapter {
  const users = adminDemoUserFixtures.map((user) => ({ ...user }))
  const organizations = demoAdminOrganizations.map((organization) => ({ ...organization }))
  const seeded = (): ImpersonationAdminSession | null => {
    const state = fixtureState()
    if (state === "active") return { ...demoAdminImpersonationSession }
    if (state === "expiring") return { ...demoAdminImpersonationSession, expiresAt: demoAdminImpersonationNow + 45_000 }
    // A nested attempt is only possible from inside an impersonation, so one is active here.
    if (state === "nested-rejected") return { ...demoAdminImpersonationSession }
    return null
  }
  let active: ImpersonationAdminSession | null = seeded()

  const failure = (state: DemoFixtureState) => {
    if (state === "error")
      return resultErrorCodedCreate(
        "impersonationAdminDemo",
        "The deterministic impersonation fixture failed.",
        "impersonation.read-failed",
      )
    if (state === "permission-denied")
      return resultErrorCodedCreate(
        "impersonationAdminDemo",
        "You do not have permission to impersonate users in this realm.",
        "authorization.forbidden",
      )
    if (state === "assurance-required")
      return resultErrorCodedCreate(
        "impersonationAdminDemo",
        "Multi-factor authentication is required to impersonate a user.",
        "authorization.insufficient-assurance",
      )
    if (state === "nested-rejected")
      return resultErrorCodedCreate(
        "impersonationAdminDemo",
        "Impersonation sessions cannot start another impersonation session.",
        "authorization.impersonation-forbidden",
      )
    return undefined
  }

  /** Reads stay available in the guarded states so the reason for the guard is always visible. */
  const read = <T>(value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    if (state === "error") return Promise.resolve(failure(state) as Result<T>)
    return Promise.resolve(value())
  }
  /** Mutations honour every guard, exactly as the server would reject them. */
  const mutate = <T>(value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    const failed = failure(state)
    if (failed !== undefined) return Promise.resolve(failed)
    return Promise.resolve(value())
  }

  return {
    activeGet: () => read(() => resultCreate(active === null ? null : { ...active })),
    eligibilityGet: () =>
      read(() => {
        const state = fixtureState()
        return resultCreate({
          actorId: demoAdminImpersonationSession.actorId,
          actorLabel: demoAdminImpersonationSession.actorLabel,
          assurance: state === "assurance-required" ? ("authenticated" as const) : ("multi_factor" as const),
          nested: state === "nested-rejected",
          permitted: state !== "permission-denied" && state !== "assurance-required" && state !== "nested-rejected",
        })
      }),
    impersonationEnd: (sessionId) =>
      mutate<{ readonly ended: boolean; readonly sessionId: string }>(() => {
        if (active === null || active.sessionId !== sessionId) return resultCreate({ ended: false, sessionId })
        active = null
        return resultCreate({ ended: true, sessionId })
      }),
    impersonationStart: (input) =>
      mutate(() => {
        const subject = users.find((user) => user.id === input.targetUserId)
        if (subject === undefined || subject.state !== "active")
          return resultErrorCodedCreate(
            "impersonationAdminDemo",
            "The impersonation target was not found or is not active.",
            "impersonation.not-found",
          )
        const started: ImpersonationAdminSession = {
          actorId: demoAdminImpersonationSession.actorId,
          actorLabel: demoAdminImpersonationSession.actorLabel,
          expiresAt: demoAdminImpersonationNow + input.durationSeconds * 1_000,
          ...(input.organizationId === undefined ? {} : { organizationId: input.organizationId }),
          reason: input.reason.trim(),
          sessionId: demoAdminImpersonationSession.sessionId,
          startedAt: demoAdminImpersonationNow,
          subjectId: subject.id,
          subjectLabel: impersonationAdminUserLabel(subject),
        }
        active = started
        return resultCreate(started)
      }),
    organizationList: () =>
      read(() =>
        resultCreate(
          organizations
            .filter((organization) => organization.status === "active")
            .map((organization) => ({ id: organization.id, name: organization.name })),
        ),
      ),
    userList: () => read(() => resultCreate(users.map((user) => ({ ...user })))),
  }
}
