import type { PasswordSessionCreate } from "../../passwords/public/passwordSessionCreate.js"
import { sessionIssue } from "../actions/sessionIssue.js"

export function sessionPasswordCreate(): PasswordSessionCreate {
  return (authentication, options) =>
    sessionIssue({
      actorId: options.actorId,
      assurance: "authenticated",
      authenticationMethod: "password",
      commandIndex: options.commandIndex,
      correlationId: options.correlationId,
      deviceMetadata: options.deviceMetadata,
      executor: options.executor,
      instanceId: authentication.instanceId,
      runtime: options.runtime,
      userId: authentication.userId,
    })
}
