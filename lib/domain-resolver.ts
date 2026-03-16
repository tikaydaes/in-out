import type { VoyagerClient } from './voyager-client.js';
import type { CompanyMetadata } from './types.js';
import { DomainCache } from './domain-cache.js';
import { ENDPOINTS, DECORATION_IDS, VOYAGER_BASE, GRAPHQL_QUERY_IDS } from './constants.js';

interface ResolveResult {
  domain: string | null;
  source: 'cache' | 'voyager' | 'typeahead';
  companyMetadata?: CompanyMetadata;
}

interface VoyagerCompanyElement {
  universalName: string;
  name: string;
  websiteUrl?: string;
  companyPageUrl?: string;
  entityUrn?: string;
  staffCount?: number;
  staffCountRange?: { start?: number; end?: number };
  industryV2Resolved?: { localizedName?: string };
  headquarter?: { city?: string; geographicArea?: string; country?: string };
  description?: string;
  tagline?: string;
  specialities?: string[];
  foundedOn?: { year?: number };
  companyType?: { localizedName?: string };
  logoV2Resolved?: { url?: string };
}

interface TypeaheadElement {
  suggestionType?: string;
  entityLockupView?: {
    title?: { text?: string };
    subtitle?: { text?: string };
    navigationUrl?: string;
  };
}

interface TypeaheadResponse {
  data?: {
    searchDashTypeaheadByGlobalTypeahead?: {
      elements?: TypeaheadElement[];
    };
  };
}

export class DomainResolver {
  private cache: DomainCache;
  private client: VoyagerClient;

  constructor(client: VoyagerClient) {
    this.cache = new DomainCache();
    this.client = client;
  }

  async resolve(
    companySlug: string,
    companyName?: string,
    companyUrn?: string,
  ): Promise<ResolveResult | null> {
    const cached = await this.cache.get(companySlug);
    if (cached) {
      return { domain: cached.domain, source: 'cache', companyMetadata: cached.companyMetadata };
    }

    // Try by company ID first if we have a URN (most reliable)
    if (companyUrn) {
      const idMatch = companyUrn.match(/(?:fsd_company|company):(\d+)/);
      if (idMatch) {
        const companyId = idMatch[1];
        const byIdResult = await this.resolveByCompanyId(companyId);
        if (byIdResult) {
          if (byIdResult.domain) {
            await this.cache.set(companySlug, byIdResult.domain, 'voyager', byIdResult.companyMetadata);
          }
          return { domain: byIdResult.domain, source: 'voyager', companyMetadata: byIdResult.companyMetadata };
        }
      }
    }

    const voyagerResult = await this.resolveViaVoyager(companySlug);
    if (voyagerResult) {
      if (voyagerResult.domain) {
        await this.cache.set(companySlug, voyagerResult.domain, 'voyager', voyagerResult.companyMetadata);
      }
      return { domain: voyagerResult.domain, source: 'voyager', companyMetadata: voyagerResult.companyMetadata };
    }
    if (companyName) {
      const typeaheadResult = await this.resolveViaTypeahead(companyName);
      if (typeaheadResult) {
        if (typeaheadResult.domain) {
          await this.cache.set(companySlug, typeaheadResult.domain, 'typeahead', typeaheadResult.companyMetadata);
        }
        return { domain: typeaheadResult.domain, source: 'typeahead', companyMetadata: typeaheadResult.companyMetadata };
      }
    }

    return null;
  }

  private async resolveByCompanyId(
    companyId: string,
  ): Promise<{ domain: string | null; companyMetadata: CompanyMetadata } | null> {
    const approaches: Array<() => Promise<Record<string, unknown>>> = [
      () => this.client.fetchFullUrl<Record<string, unknown>>(
        `${VOYAGER_BASE}/organization/companies/${companyId}?decorationId=${DECORATION_IDS.COMPANY}`
      ),
      () => this.client.fetchFullUrl<Record<string, unknown>>(
        `${VOYAGER_BASE}/organization/companies/${companyId}`
      ),
      () => this.client.fetchFullUrl<Record<string, unknown>>(
        `${VOYAGER_BASE}/organization/companies/(entityUrn:urn%3Ali%3Afsd_company%3A${companyId})?decorationId=${DECORATION_IDS.COMPANY}`
      ),
      () => this.client.fetchFullUrl<Record<string, unknown>>(
        `${VOYAGER_BASE}/organization/companies/(entityUrn:urn%3Ali%3Aorganization%3A${companyId})?decorationId=${DECORATION_IDS.COMPANY}`
      ),
      () => this.client.fetchFullUrl<Record<string, unknown>>(
        `${VOYAGER_BASE}/organization/dash/companies/${companyId}`
      ),
      () => this.client.fetchFullUrl<Record<string, unknown>>(
        `${VOYAGER_BASE}/organization/dash/companies/(entityUrn:urn%3Ali%3Afsd_company%3A${companyId})`
      ),
    ];

    for (const fn of approaches) {
      try {
        const response = await fn();

        const directCompany = response as unknown as VoyagerCompanyElement;
        if (directCompany?.name) {
          return this.buildCompanyResult(directCompany);
        }

        const elements = (response as { elements?: VoyagerCompanyElement[] }).elements
          ?? (response as { data?: { elements?: VoyagerCompanyElement[] } }).data?.elements;
        const company = elements?.[0];
        if (company?.name) {
          return this.buildCompanyResult(company);
        }

      } catch {
      }
    }

    return null;
  }

  private buildCompanyResult(company: VoyagerCompanyElement): { domain: string | null; companyMetadata: CompanyMetadata } {
    const domain = company.websiteUrl ? this.extractDomain(company.websiteUrl) : null;

    const staffCountRange = company.staffCountRange
      ? `${company.staffCountRange.start ?? ''}${company.staffCountRange.end ? `-${company.staffCountRange.end}` : '+'}`
      : null;

    const companyMetadata: CompanyMetadata = {
      name: company.name,
      domain,
      slug: company.universalName,
      industry: company.industryV2Resolved?.localizedName ?? null,
      staffCount: company.staffCount ?? null,
      staffCountRange,
      description: company.description ?? null,
      tagline: company.tagline ?? null,
      specialties: company.specialities ?? [],
      foundedYear: company.foundedOn?.year ?? null,
      headquarterCity: company.headquarter?.city ?? null,
      headquarterState: company.headquarter?.geographicArea ?? null,
      headquarterCountry: company.headquarter?.country ?? null,
      companyType: company.companyType?.localizedName ?? null,
    };

    return { domain, companyMetadata };
  }

  private async resolveViaVoyager(
    companySlug: string
  ): Promise<{ domain: string | null; companyMetadata: CompanyMetadata } | null> {
    try {
      let response = await this.client.fetch<Record<string, unknown>>(ENDPOINTS.COMPANY, {
        decorationId: DECORATION_IDS.COMPANY_RICH,
        q: 'universalName',
        universalName: companySlug,
      }).catch(() => null);

      if (!response) {
        response = await this.client.fetch<Record<string, unknown>>(ENDPOINTS.COMPANY, {
          decorationId: DECORATION_IDS.COMPANY,
          q: 'universalName',
          universalName: companySlug,
        });
      }

      const elements = (response as { elements?: VoyagerCompanyElement[] }).elements
        ?? (response as { data?: { elements?: VoyagerCompanyElement[] } }).data?.elements;
      const company = elements?.[0];
      if (!company) {
        return null;
      }

      const domain = company.websiteUrl ? this.extractDomain(company.websiteUrl) : null;

      const staffCountRange = company.staffCountRange
        ? `${company.staffCountRange.start ?? ''}${company.staffCountRange.end ? `-${company.staffCountRange.end}` : '+'}`
        : null;

      const companyMetadata: CompanyMetadata = {
        name: company.name,
        domain,
        slug: company.universalName,
        industry: company.industryV2Resolved?.localizedName ?? null,
        staffCount: company.staffCount ?? null,
        staffCountRange,
        description: company.description ?? null,
        tagline: company.tagline ?? null,
        specialties: company.specialities ?? [],
        foundedYear: company.foundedOn?.year ?? null,
        headquarterCity: company.headquarter?.city ?? null,
        headquarterState: company.headquarter?.geographicArea ?? null,
        headquarterCountry: company.headquarter?.country ?? null,
        companyType: company.companyType?.localizedName ?? null,
      };

      return { domain, companyMetadata };
    } catch {
      return null;
    }
  }

  private async resolveViaTypeahead(
    companyName: string
  ): Promise<{ domain: string | null; companyMetadata: CompanyMetadata } | null> {
    try {
      const url = `${VOYAGER_BASE}/graphql?variables=(query:${encodeURIComponent(companyName)})&queryId=${GRAPHQL_QUERY_IDS.TYPEAHEAD}`;
      const rawResponse = await this.client.fetchFullUrl<Record<string, unknown>>(url);
      const response = rawResponse as unknown as TypeaheadResponse;
      const elements = response.data?.searchDashTypeaheadByGlobalTypeahead?.elements ?? [];
      // First try: direct /company/ URL in navigation
      const companyResult = elements.find((el) => {
        const navUrl = el.entityLockupView?.navigationUrl ?? '';
        return navUrl.includes('/company/');
      });

      if (companyResult?.entityLockupView?.navigationUrl) {
        const slugMatch = companyResult.entityLockupView.navigationUrl.match(/\/company\/([^/?#]+)/);
        if (slugMatch?.[1]) {
          return this.resolveViaVoyager(slugMatch[1]);
        }
      }

      // Second try: extract company ID from heroEntityKey in search URLs
      for (const el of elements) {
        const navUrl = el.entityLockupView?.navigationUrl ?? '';
        const heroMatch = navUrl.match(/heroEntityKey=urn%3Ali%3Aorganization%3A(\d+)/);
        if (heroMatch?.[1]) {
          const companyId = heroMatch[1];
          const byIdResult = await this.resolveByCompanyId(companyId);
          if (byIdResult) return byIdResult;
        }
      }

    } catch {
      return null;
    }

    return null;
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      let hostname = parsed.hostname;

      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4);
      }

      return hostname;
    } catch {
      return url;
    }
  }
}
