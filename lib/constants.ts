export const VOYAGER_BASE = 'https://www.linkedin.com/voyager/api';

export const ENDPOINTS = {
  CONNECTIONS: '/relationships/dash/connections',
  COMPANY: '/organization/companies',
  ADMIN_COMPANIES: '/organization/companies',
  PROFILE: '/identity/dash/profiles',
  PROFILE_CARDS: '/identity/dash/profileCards',
  ME: '/me',
} as const;

export const ADMIN_COMPANIES_PARAMS = {
  q: 'admin',
  start: '0',
  count: '100',
} as const;

export const DECORATION_IDS = {
  CONNECTIONS: 'com.linkedin.voyager.dash.deco.web.mynetwork.ConnectionListWithProfile-16',
  COMPANY: 'com.linkedin.voyager.dash.deco.organization.MiniCompany-12',
  COMPANY_RICH: 'com.linkedin.voyager.dash.deco.organization.MiniCompany-14',
  PROFILE_TOP_CARD: 'com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-19',
  PROFILE_FULL: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
} as const;

export const RATE_LIMIT = {
  BASE_DELAY_MS: 2000,
  JITTER_MAX_MS: 1500,
  BATCH_PAUSE_MS: 10000,
  BATCH_SIZE_MIN: 3,
  BATCH_SIZE_MAX: 7,
  MAX_RETRIES: 3,
  BACKOFF_MULTIPLIER: 2,
  READING_PAUSE_CHANCE: 0.10,
  READING_PAUSE_MIN_MS: 3000,
  READING_PAUSE_MAX_MS: 8000,
  SESSION_SPEED_MIN: 0.8,
  SESSION_SPEED_MAX: 1.5,
} as const;

export const PAGE_SIZE = 40;
export const DOMAIN_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CSRF_TOKEN_PREFIX = 'ajax:';
export const DOMAIN_CACHE_PREFIX = 'domain:';

export const SESSION_STATE_KEY = 'scrapeSession';
export const CONSENT_STORAGE_KEY = 'consentAccepted';
export const PRIVACY_POLICY_VERSION = '1.0';
export const GRAPHQL_QUERY_IDS = {
  COMPANY_FOLLOWERS: 'voyagerOrganizationDashFollowers.36569e7e40afe58d8bc91299def4c53b',
  SEARCH_CLUSTERS: 'voyagerSearchDashClusters.ef3d0937fb65bd7812e3',
  TYPEAHEAD: 'voyagerSearchDashTypeahead.fa9acbcb761f7b5ec2c808e6da796296',
} as const;

export const COMPANY_FOLLOWERS_PAGE_SIZE = 10;
export const SEARCH_CLUSTERS_PAGE_SIZE = 10;
