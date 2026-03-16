export type ScrapeMode = 'connections' | 'company-followers' | 'followers' | 'following' | 'manual-list';

export interface CompanyMetadata {
  name: string;
  domain: string | null;
  slug: string;
  industry: string | null;
  staffCount: number | null;
  staffCountRange: string | null;
  description: string | null;
  tagline: string | null;
  specialties: string[];
  foundedYear: number | null;
  headquarterCity: string | null;
  headquarterState: string | null;
  headquarterCountry: string | null;
  companyType: string | null;
}

export interface Education {
  school: string;
  degree: string | null;
  field: string | null;
}

export interface ScrapedPerson {
  firstName: string;
  lastName: string;
  headline?: string;
  summary?: string;
  currentTitle?: string;
  currentCompany?: string;
  companyLinkedInSlug?: string;
  companyDomain?: string;
  profileUrl?: string;
  entityUrn?: string;
  location?: string;
  industry?: string;
  skills?: string[];
  educations?: Education[];
  languages?: string[];
  companyMetadata?: CompanyMetadata;
}

export interface ExportMetadata {
  exportedAt: string;
  source: ScrapeMode;
  totalScraped: number;
  totalWithDomain: number;
  extensionVersion: string;
}

export type ScrapeStatus = 'idle' | 'scraping' | 'paused' | 'done' | 'error';

export interface ScrapeProgress {
  mode: ScrapeMode;
  total?: number;
  scraped: number;
  withDomain: number;
  status: ScrapeStatus;
  errorMessage?: string;
}

export interface VoyagerPaging {
  start: number;
  count: number;
  total?: number;
}

export interface CompanyDomainEntry {
  domain: string;
  resolvedAt: number;
  source: 'voyager' | 'typeahead' | 'manual';
  companyMetadata?: CompanyMetadata;
}

export interface CacheStats {
  totalCached: number;
  oldestEntry: number | null;
}

export interface PageContext {
  pageType: 'company' | 'profile' | 'connections' | 'other';
  companySlug?: string;
}

export interface AdminCompany {
  name: string;
  id: string;
  universalName: string;
}

export type MessageType =
  | { type: 'START_SCRAPE'; mode: ScrapeMode; companySlug?: string; manualListText?: string }
  | { type: 'STOP_SCRAPE' }
  | { type: 'GET_PROGRESS' }
  | { type: 'EXPORT_DATA' }
  | { type: 'GET_CACHE_STATS' }
  | { type: 'GET_ADMIN_COMPANIES' }
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'PROGRESS_UPDATE'; progress: ScrapeProgress }
  | { type: 'PAGE_CONTEXT'; context: PageContext }
  | { type: 'CACHE_STATS'; stats: CacheStats }
  | { type: 'ADMIN_COMPANIES'; companies: AdminCompany[] };
