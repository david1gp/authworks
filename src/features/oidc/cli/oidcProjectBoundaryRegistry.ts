export type OidcProjectBoundaryEnvironment = "production" | "development"

export type OidcProjectBoundaryConfig = {
  readonly slug: string
  readonly displayName: string
  readonly productionName: string
  readonly developmentName: string
  readonly productionRedirectUris: readonly string[]
  readonly developmentRedirectUris: readonly string[]
  readonly productionPostLogoutRedirectUris?: readonly string[]
  readonly developmentPostLogoutRedirectUris?: readonly string[]
  readonly adoptSharedClientByRedirectUri?: true
  readonly allowedScopes?: readonly string[]
}

// Development callbacks keep the legacy `leonardomora.de` host next to its
// same-prefix `wonder1.de` alias. The ensure commands overwrite the client
// redirect URIs with these lists, so a live-only alias would be erased again.
const oidcProjectBoundaryConfigs: readonly OidcProjectBoundaryConfig[] = [
  {
    slug: "eventoren",
    displayName: "Eventoren",
    productionName: "Eventoren production",
    developmentName: "Eventoren development",
    productionRedirectUris: ["https://eventoren.de/login/authworks/callback"],
    developmentRedirectUris: [
      "https://eventoren.leonardomora.de/login/authworks/callback",
      "https://eventoren.wonder1.de/login/authworks/callback",
    ],
  },
  {
    slug: "solid-convex",
    displayName: "Solid Convex",
    productionName: "Solid-Convex production",
    developmentName: "Solid-Convex development",
    productionRedirectUris: ["https://solid-convex-api.contentoren.de/api/auth/authworks/callback"],
    developmentRedirectUris: [
      "https://solid-convex-api.leonardomora.de/api/auth/authworks/callback",
      "https://solid-convex-api.wonder1.de/api/auth/authworks/callback",
    ],
  },
  {
    slug: "semesterkur",
    displayName: "Semesterkur",
    productionName: "Semesterkur production",
    developmentName: "Semesterkur development",
    productionRedirectUris: ["https://semesterkur.com/login/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3053/login/authworks/callback",
      "https://semesterkur.leonardomora.de/login/authworks/callback",
      "https://semesterkur.wonder1.de/login/authworks/callback",
    ],
  },
  {
    slug: "coachingcompany",
    displayName: "Coaching Company",
    productionName: "Coaching Company production",
    developmentName: "Coaching Company development",
    productionRedirectUris: ["https://coachingcompany.contentoren.de/login/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3134/login/authworks/callback",
      "https://coachingcompany.leonardomora.de/login/authworks/callback",
      "https://coachingcompany-v2.wonder1.de/login/authworks/callback",
      "https://coachingcompany.wonder1.de/login/authworks/callback",
    ],
  },
  {
    slug: "filmschauspielschule",
    displayName: "Filmschauspielschule",
    productionName: "Filmschauspielschule production",
    developmentName: "Filmschauspielschule development",
    productionRedirectUris: ["https://filmschauspielschule.contentoren.de/login/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3132/login/authworks/callback",
      "https://filmschauspielschule.leonardomora.de/login/authworks/callback",
      "https://preview.filmschauspielschule-v2.wonder1.de/login/authworks/callback",
      "https://preview.filmschauspielschule.wonder1.de/login/authworks/callback",
    ],
  },
  {
    // The live "CRM SSO (preview + production)" client predates the split
    // production/development boundary and holds the preview + production
    // callbacks under one differently named client. Adopt it by redirect-URI
    // match: never rename, delete, or rotate it.
    slug: "crm",
    displayName: "CRM",
    productionName: "CRM production",
    developmentName: "CRM development",
    productionRedirectUris: [
      "https://crm.contentoren.de/auth/authworks/callback",
      "https://crm-api.wonder1.de/api/auth/authworks/callback",
    ],
    developmentRedirectUris: ["http://127.0.0.1:5173/auth/authworks/callback"],
    adoptSharedClientByRedirectUri: true,
  },
  {
    slug: "allgroups-chat",
    displayName: "Allgroups Chat",
    productionName: "Allgroups Chat production",
    developmentName: "Allgroups Chat development",
    productionRedirectUris: ["https://allgroups.chat/login/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3017/login/authworks/callback",
      "https://preview.allgroups.chat/login/authworks/callback",
    ],
  },
  {
    slug: "akademie",
    displayName: "Akademie",
    productionName: "Akademie production",
    developmentName: "Akademie development",
    productionRedirectUris: ["https://api.akademie.contentoren.de/api/auth/authworks"],
    developmentRedirectUris: ["https://akademie-api.wonder1.de/api/auth/authworks"],
  },
  {
    slug: "archive",
    displayName: "Archive",
    productionName: "Archive production",
    developmentName: "Archive development",
    productionRedirectUris: ["https://archive-api.contentoren.de/api/auth/authworks/callback"],
    developmentRedirectUris: [
      "http://127.0.0.1:3243/api/auth/authworks/callback",
      "https://archive-api.leonardomora.de/api/auth/authworks/callback",
      "https://archive-api.wonder1.de/api/auth/authworks/callback",
    ],
    productionPostLogoutRedirectUris: ["https://archive.contentoren.de"],
  },
  {
    // No live development client exists; the registry type requires both
    // environments, so development stays an empty list the server would
    // reject on ensure until a live development callback is known.
    slug: "sales",
    displayName: "Sales",
    productionName: "Sales production",
    developmentName: "Sales development",
    productionRedirectUris: ["https://api.sales.contentoren.de/login/authworks/callback"],
    developmentRedirectUris: [],
  },
  {
    // No live development client exists; see the sales entry.
    slug: "billing",
    displayName: "Billing",
    productionName: "Billing production",
    developmentName: "Billing development",
    productionRedirectUris: ["https://billing.contentoren.de/login/authworks/callback"],
    developmentRedirectUris: [],
  },
  {
    // No live development client exists; see the sales entry.
    slug: "services",
    displayName: "Services",
    productionName: "Services production",
    developmentName: "Services development",
    productionRedirectUris: ["https://services.contentoren.de/login/authworks/callback"],
    developmentRedirectUris: [],
  },
  {
    // No live development client exists; see the sales entry.
    slug: "site-crawler",
    displayName: "Site Crawler",
    productionName: "Site Crawler production",
    developmentName: "Site Crawler development",
    productionRedirectUris: ["https://site-crawler.leonardomora.de/api/auth/authworks/callback"],
    developmentRedirectUris: [],
  },
  {
    slug: "multisub",
    displayName: "Multisub",
    productionName: "Multisub production",
    developmentName: "Multisub development",
    productionRedirectUris: ["https://multisub.contentoren.de/auth/authworks/callback"],
    developmentRedirectUris: [
      "http://localhost:1455/auth/authworks/callback",
      "https://multisub-dev.leonardomora.de/auth/authworks/callback",
      "https://multisub-dev.wonder1.de/auth/authworks/callback",
    ],
    productionPostLogoutRedirectUris: ["https://multisub.contentoren.de/"],
    developmentPostLogoutRedirectUris: ["https://multisub-dev.wonder1.de/", "https://multisub-dev.leonardomora.de/"],
  },
  {
    // No live development client exists; see the sales entry.
    slug: "work",
    displayName: "Work",
    productionName: "Work production",
    developmentName: "Work development",
    productionRedirectUris: [
      "https://work.semesterkur.com/auth/authworks/callback",
      "https://work.wonder1.de/auth/authworks/callback",
    ],
    developmentRedirectUris: [],
  },
  {
    // No leonardomora.de alias: the legacy host is retired, so development
    // holds only the live wonder1.de callback.
    slug: "assets-service",
    displayName: "Assets Service",
    productionName: "Assets Service production",
    developmentName: "Assets Service development",
    productionRedirectUris: ["https://assets-service.contentoren.de/api/v1/auth/authworks/callback"],
    developmentRedirectUris: ["https://assets-service.wonder1.de/api/v1/auth/authworks/callback"],
    allowedScopes: ["openid", "profile", "email", "urn:zitadel:iam:user:resourceowner"],
  },
]

export const oidcProjectBoundaryRegistry: Record<string, OidcProjectBoundaryConfig> = Object.fromEntries(
  oidcProjectBoundaryConfigs.map((config) => [config.slug, config]),
)
