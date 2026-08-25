import { accountErrorCatalog } from "../../features/account/errors/accountErrorCatalog.js"
import { authorizationErrorCatalog } from "../../features/authorization/errors/authorizationErrorCatalog.js"
import { emailErrorCatalog } from "../../features/email/errors/emailErrorCatalog.js"
import { emailOtpErrorCatalog } from "../../features/emailOtp/errors/emailOtpErrorCatalog.js"
import { eventsErrorCatalog } from "../../features/events/errors/eventsErrorCatalog.js"
import { externalIdentitiesErrorCatalog } from "../../features/externalIdentities/errors/externalIdentitiesErrorCatalog.js"
import { impersonationErrorCatalog } from "../../features/impersonation/errors/impersonationErrorCatalog.js"
import { machineUsersErrorCatalog } from "../../features/machineUsers/errors/machineUsersErrorCatalog.js"
import { mfaErrorCatalog } from "../../features/mfa/errors/mfaErrorCatalog.js"
import { oidcErrorCatalog } from "../../features/oidc/errors/oidcErrorCatalog.js"
import { organizationsErrorCatalog } from "../../features/organizations/errors/organizationsErrorCatalog.js"
import { passkeysErrorCatalog } from "../../features/passkeys/errors/passkeysErrorCatalog.js"
import { passwordsErrorCatalog } from "../../features/passwords/errors/passwordsErrorCatalog.js"
import { projectsErrorCatalog } from "../../features/projects/errors/projectsErrorCatalog.js"
import { realmsErrorCatalog } from "../../features/realms/errors/realmsErrorCatalog.js"
import { sessionsErrorCatalog } from "../../features/sessions/errors/sessionsErrorCatalog.js"
import { usersErrorCatalog } from "../../features/users/errors/usersErrorCatalog.js"
import { wahaErrorCatalog } from "../../features/waha/errors/wahaErrorCatalog.js"
import { whatsappOtpErrorCatalog } from "../../features/whatsappOtp/errors/whatsappOtpErrorCatalog.js"
import { zitadelMigrationErrorCatalog } from "../../features/zitadelMigration/errors/zitadelMigrationErrorCatalog.js"
import { errorCatalogCompose } from "./errorCatalogCompose.js"
import { platformErrorCatalog } from "./platformErrorCatalog.js"

export const errorCatalog = errorCatalogCompose(
  platformErrorCatalog,
  accountErrorCatalog,
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
  emailErrorCatalog,
  emailOtpErrorCatalog,
  eventsErrorCatalog,
  realmsErrorCatalog,
  usersErrorCatalog,
  wahaErrorCatalog,
  whatsappOtpErrorCatalog,
  zitadelMigrationErrorCatalog,
)
