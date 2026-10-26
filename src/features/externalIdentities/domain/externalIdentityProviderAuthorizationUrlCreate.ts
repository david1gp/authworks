import { type Result } from "#result"
import type {
  ExternalIdentityProviderPort,
  ExternalIdentityProviderPortConfiguration,
  ExternalIdentityProviderPortStartInput,
} from "./externalIdentityProviderPort.js"

export function externalIdentityProviderAuthorizationUrlCreate(
  port: ExternalIdentityProviderPort,
  configuration: ExternalIdentityProviderPortConfiguration,
  input: ExternalIdentityProviderPortStartInput,
): Promise<Result<string>> {
  if (port.authorizationUrlCreateAsync !== undefined) return port.authorizationUrlCreateAsync(configuration, input)
  return Promise.resolve(port.authorizationUrlCreate(configuration, input))
}
