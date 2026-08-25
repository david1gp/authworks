import type { PasswordSessionCreate } from "../../passwords/domain/passwordSessionCreate.js"
import { sessionIssue } from "./sessionIssue.js"

export function sessionPasswordCreate(): PasswordSessionCreate {
  return (authentication, options) =>
    sessionIssue({
      actorId: options.actorId,
      assurance: "authenticated",
      authenticationMethod: "password",
      commandIndex: options.commandIndex,
      correlationId: options.correlationId,
      database: options.database,
      deviceMetadata: options.deviceMetadata,
      executor: options.executor,
      organizationId: options.organizationId,
      realmId: authentication.realmId,
      runtime: options.runtime,
      userId: authentication.userId,
    })
}
