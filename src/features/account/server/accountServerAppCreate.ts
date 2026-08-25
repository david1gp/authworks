import { Hono } from "hono"
import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { httpResultResponseCreate } from "../../../platform/http/httpResultResponseCreate.js"
import { listQueryFromSearchParams } from "../../../platform/http/listQueryFromSearchParams.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { sessionProtectedMiddlewareCreate } from "../../sessions/server/sessionProtectedMiddlewareCreate.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { accountEffectiveAccessList } from "../actions/accountEffectiveAccessList.js"

type AccountServerAppCreateOptions = {
  readonly database: StorageDatabase
  readonly publicOrigin?: string
}

type AccountServerEnv = {
  Variables: {
    authorizationActor: AuthorizationActorContext
    session: Session
  }
}

export function accountServerAppCreate(options: AccountServerAppCreateOptions) {
  const app = new Hono<AccountServerEnv>()
  const protectedMiddleware = sessionProtectedMiddlewareCreate({
    database: options.database,
    publicOrigin: options.publicOrigin,
  })
  app.get("/realms/:realmId/me/effective-access", protectedMiddleware, (context) => {
    const query = listQueryFromSearchParams(new URL(context.req.url).searchParams)
    if (!query.success) return accountErrorResponseCreate(context, query)
    return accountResultResponseCreate(
      context,
      accountEffectiveAccessList({
        actor: context.get("authorizationActor"),
        database: options.database,
        query: query.data,
        realmId: context.req.param("realmId"),
        subjectId: context.get("session").subjectId,
      }),
    )
  })
  return app
}

function accountErrorResponseCreate(
  context: {
    json: (body: unknown, status?: number) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: { errorMessage: string; op: string; code?: string; success?: false },
) {
  const coded =
    result.code === undefined ? resultErrorCodedCreate(result.op, result.errorMessage, "account.invalid") : result
  return httpResultResponseCreate(context, coded as Result<never>)
}

function accountResultResponseCreate<T>(
  context: {
    json: (body: unknown, status?: number) => Response
    req: { header: (name: string) => string | undefined }
  },
  result: Result<T>,
) {
  return httpResultResponseCreate(context, result)
}
