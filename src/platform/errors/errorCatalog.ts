import { errorCatalogCompose } from "./errorCatalogCompose.js"
import { authorizationErrorCatalog } from "../../features/authorization/errors/authorizationErrorCatalog.js"
import { externalIdentitiesErrorCatalog } from "../../features/externalIdentities/errors/externalIdentitiesErrorCatalog.js"
import { emailOtpErrorCatalog } from "../../features/emailOtp/errors/emailOtpErrorCatalog.js"
import { impersonationErrorCatalog } from "../../features/impersonation/errors/impersonationErrorCatalog.js"
import { machineUsersErrorCatalog } from "../../features/machineUsers/errors/machineUsersErrorCatalog.js"
import { mfaErrorCatalog } from "../../features/mfa/errors/mfaErrorCatalog.js"
import { oidcErrorCatalog } from "../../features/oidc/errors/oidcErrorCatalog.js"
import { passkeysErrorCatalog } from "../../features/passkeys/errors/passkeysErrorCatalog.js"
import { passwordsErrorCatalog } from "../../features/passwords/errors/passwordsErrorCatalog.js"
import { platformErrorCatalog } from "./platformErrorCatalog.js"
import { projectsErrorCatalog } from "../../features/projects/errors/projectsErrorCatalog.js"
import { organizationsErrorCatalog } from "../../features/organizations/errors/organizationsErrorCatalog.js"
import { realmsErrorCatalog } from "../../features/realms/errors/realmsErrorCatalog.js"
import { sessionsErrorCatalog } from "../../features/sessions/errors/sessionsErrorCatalog.js"
import { usersErrorCatalog } from "../../features/users/errors/usersErrorCatalog.js"

export const errorCatalog = errorCatalogCompose(
  platformErrorCatalog,
  projectsErrorCatalog,
  oidcErrorCatalog,
  organizationsErrorCatalog,
  machineUsersErrorCatalog,
  sessionsErrorCatalog,
  externalIdentitiesErrorCatalog,
  passkeysErrorCatalog,
  passwordsErrorCatalog,
  mfaErrorCatalog,
  impersonationErrorCatalog,
  authorizationErrorCatalog,
  emailOtpErrorCatalog,
  realmsErrorCatalog,
  usersErrorCatalog,
)
