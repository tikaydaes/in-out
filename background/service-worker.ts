import type {
  MessageType,
  ScrapeMode,
  ScrapeProgress,
  ScrapeStatus,
  ScrapedPerson,
  CacheStats,
  AdminCompany,
} from '../lib/types.js';
import { SESSION_STATE_KEY, ENDPOINTS, ADMIN_COMPANIES_PARAMS } from '../lib/constants.js';
import { getCSRFToken } from '../lib/csrf.js';
import { VoyagerClient, type FetchFn } from '../lib/voyager-client.js';
import { DomainResolver } from '../lib/domain-resolver.js';
import { DomainCache } from '../lib/domain-cache.js';
import { scrapeConnections } from '../lib/scrape-connections.js';
import { scrapeCompanyFollowers } from '../lib/scrape-company-followers.js';
import { scrapeFollows } from '../lib/scrape-follows.js';
import { buildJsonl, generateFilename, triggerDownload } from '../lib/export.js';
import { searchProfile } from '../lib/profile-search.js';
import { fetchFullProfile } from '../lib/profile-fetcher.js';
import { RateLimiter } from '../lib/rate-limiter.js';

async function findLinkedInTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  const tab = tabs.find((t) => t.id !== undefined);
  if (!tab?.id) {
    throw new Error('No LinkedIn tab found — please open LinkedIn in a tab first');
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['dist/content.js'],
    });
  }

  return tab.id;
}

function createProxyFetch(tabId: number): FetchFn {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    if (init?.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    const { signal: _, ...rest } = init || {};
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'VOYAGER_FETCH',
      url,
      options: {
        method: rest.method || 'GET',
        headers: rest.headers,
        credentials: rest.credentials,
      },
    });

    if (result?.error && result.status === 0) {
      throw new Error(result.error);
    }

    return new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
    });
  };
}

interface SessionState {
  mode: ScrapeMode;
  scrapedPersons: ScrapedPerson[];
  progress: ScrapeProgress;
}

class ScrapeOrchestrator {
  private currentProgress: ScrapeProgress = {
    mode: 'connections',
    scraped: 0,
    withDomain: 0,
    status: 'idle',
  };
  private scrapedPersons: ScrapedPerson[] = [];
  private abortController: AbortController | null = null;
  private domainCache = new DomainCache();

  constructor() {
    this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    try {
      const result = await chrome.storage.session.get(SESSION_STATE_KEY);
      const sessionState: SessionState | undefined = result[SESSION_STATE_KEY];

      if (sessionState && sessionState.progress.status === 'scraping') {
        this.scrapedPersons = sessionState.scrapedPersons;
        this.currentProgress = { ...sessionState.progress, status: 'paused' };
        await this.persistSession();
      }
    } catch (error) {
      /* Session restoration failed - start fresh */
    }
  }

  private async persistSession(): Promise<void> {
    const sessionState: SessionState = {
      mode: this.currentProgress.mode,
      scrapedPersons: this.scrapedPersons,
      progress: this.currentProgress,
    };
    await chrome.storage.session.set({ [SESSION_STATE_KEY]: sessionState });
  }

  private async clearSession(): Promise<void> {
    await chrome.storage.session.remove(SESSION_STATE_KEY);
  }

  private async broadcastProgress(): Promise<void> {
    const message: MessageType = {
      type: 'PROGRESS_UPDATE',
      progress: this.currentProgress,
    };
    await chrome.runtime.sendMessage(message).catch(() => {});
  }

  private updateProgress(
    status: ScrapeStatus,
    updates: Partial<ScrapeProgress> = {}
  ): void {
    this.currentProgress = {
      ...this.currentProgress,
      status,
      ...updates,
    };
    this.broadcastProgress();
    this.persistSession();
  }

  async startScrape(mode: ScrapeMode, companySlug?: string, manualListText?: string): Promise<void> {
    if (this.currentProgress.status === 'scraping') {
      throw new Error('Scrape already in progress');
    }

    this.scrapedPersons = [];
    this.currentProgress = {
      mode,
      scraped: 0,
      withDomain: 0,
      status: 'scraping',
    };
    this.abortController = new AbortController();

    await this.broadcastProgress();
    await this.persistSession();

    try {
      const tabId = await findLinkedInTabId();
      const proxyFetch = createProxyFetch(tabId);
      const csrfToken = await getCSRFToken();
      const client = new VoyagerClient(csrfToken, proxyFetch);
      const resolver = new DomainResolver(client);

      if (mode === 'manual-list') {
        await this.handleManualList(manualListText || '', client, resolver);
        return;
      }

      let scraper: AsyncGenerator<ScrapedPerson[]>;

      if (mode === 'connections') {
        scraper = scrapeConnections(
          client,
          this.abortController.signal,
          (scraped, total) => {
            this.updateProgress('scraping', { scraped, total });
          }
        );
      } else if (mode === 'company-followers') {
        if (!companySlug) {
          throw new Error('Company slug or ID required for company-followers mode');
        }

        const companyId = await this.resolveCompanyId(client, companySlug);

        scraper = scrapeCompanyFollowers(
          client,
          companyId,
          this.abortController.signal,
          (scraped) => {
            this.updateProgress('scraping', { scraped });
          }
        );
      } else if (mode === 'followers') {
        scraper = scrapeFollows(
          client,
          'FOLLOWERS',
          this.abortController.signal,
          (scraped) => {
            this.updateProgress('scraping', { scraped });
          }
        );
      } else if (mode === 'following') {
        scraper = scrapeFollows(
          client,
          'FOLLOWING',
          this.abortController.signal,
          (scraped) => {
            this.updateProgress('scraping', { scraped });
          }
        );
      } else {
        throw new Error(`Unknown scrape mode: ${mode}`);
      }

      for await (const page of scraper) {
        if (this.abortController.signal.aborted) {
          break;
        }

        for (const person of page) {
          if (person.currentCompany && !person.companyDomain) {
            const companySlugFromHeadline = this.extractCompanySlug(
              person.currentCompany
            );
            if (companySlugFromHeadline) {
              try {
                const resolved = await resolver.resolve(
                  companySlugFromHeadline,
                  person.currentCompany
                );
                if (resolved) {
                  if (resolved.domain) person.companyDomain = resolved.domain;
                  person.companyLinkedInSlug = companySlugFromHeadline;
                  person.companyMetadata = resolved.companyMetadata;
                }
              } catch {
                /* Domain resolution failed - continue without domain */
              }
            }
          }
        }

        this.scrapedPersons.push(...page);

        const withDomain = this.scrapedPersons.filter(
          (p) => p.companyDomain
        ).length;
        this.updateProgress('scraping', {
          scraped: this.scrapedPersons.length,
          withDomain,
        });
      }

      if (this.abortController.signal.aborted) {
        this.updateProgress('paused');
      } else {
        this.updateProgress('done');
      }
    } catch (error) {
      const errorMessage = this.parseError(error);
      this.updateProgress('error', { errorMessage });
    } finally {
      this.abortController = null;
    }
  }

  private async fetchCompanyId(client: VoyagerClient, companySlug: string): Promise<{ urn: string; id: string } | null> {
    try {
      const response = await client.fetch<Record<string, unknown>>('/organization/companies', {
        decorationId: 'com.linkedin.voyager.dash.deco.organization.MiniCompany-12',
        q: 'universalName',
        universalName: companySlug,
      });

      const elements = (response as { elements?: Array<{ entityUrn?: string }> }).elements
        ?? (response as { data?: { elements?: Array<{ entityUrn?: string }> } }).data?.elements;
      const company = elements?.[0];
      if (!company?.entityUrn) {
        return null;
      }

      const match = company.entityUrn.match(/urn:li:fsd_company:(\d+)/);
      if (!match) {
        return null;
      }

      return {
        urn: company.entityUrn,
        id: match[1],
      };
    } catch (error) {
      return null;
    }
  }

  private async resolveCompanyId(client: VoyagerClient, companySlugOrId: string): Promise<string> {
    if (/^\d+$/.test(companySlugOrId)) {
      return companySlugOrId;
    }

    const companyData = await this.fetchCompanyId(client, companySlugOrId);
    if (!companyData) {
      throw new Error(`Company not found: ${companySlugOrId}`);
    }
    return companyData.id;
  }

  private async handleManualList(
    text: string,
    client: VoyagerClient,
    resolver: DomainResolver
  ): Promise<void> {
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    const parsed: ScrapedPerson[] = [];

    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 2) continue;

      const [fullName, company] = parts;
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ');

      if (!firstName) continue;

      parsed.push({
        firstName,
        lastName,
        currentCompany: company || undefined,
      });
    }

    this.updateProgress('scraping', { total: parsed.length, scraped: 0 });

    const rateLimiter = new RateLimiter();

    for (let i = 0; i < parsed.length; i++) {
      if (this.abortController?.signal.aborted) {
        this.updateProgress('paused');
        return;
      }

      const person = parsed[i];

      // Step 1: Typeahead search to find the person on LinkedIn
      let publicIdentifier: string | undefined;
      try {
        const found = await searchProfile(client, person.firstName, person.lastName, person.currentCompany);
        if (found) {
          Object.assign(person, found);
          const idMatch = person.profileUrl?.match(/\/in\/([^/?]+)/);
          publicIdentifier = idMatch?.[1];
        }
      } catch {
      }

      // Step 2: Fetch the actual profile for rich data (location, real company slug + URN)
      let realCompanySlug: string | null = null;
      let companyUrn: string | null = null;
      let companyWebsiteUrl: string | null = null;
      if (publicIdentifier) {
        try {
          const profile = await fetchFullProfile(client, publicIdentifier);
          if (profile) {
            if (profile.location) person.location = profile.location;
            if (profile.currentTitle) person.currentTitle = profile.currentTitle;
            if (profile.currentCompany) person.currentCompany = profile.currentCompany;
            if (profile.publicIdentifier) {
              person.profileUrl = `https://www.linkedin.com/in/${profile.publicIdentifier}`;
            }
            if (profile.summary) person.summary = profile.summary;
            if (profile.industry) person.industry = profile.industry;
            if (profile.skills.length > 0) person.skills = profile.skills;
            if (profile.educations.length > 0) person.educations = profile.educations;
            if (profile.languages.length > 0) person.languages = profile.languages;
            realCompanySlug = profile.companyUniversalName;
            companyUrn = profile.companyUrn;
            companyWebsiteUrl = profile.companyWebsiteUrl;
          }
        } catch {
        }
      }

      // Step 3: Resolve company domain/metadata using the REAL slug from the profile
      const companySlug = realCompanySlug || this.extractCompanySlug(person.currentCompany || '');
      if (companySlug) {
        try {
          const resolved = await resolver.resolve(companySlug, person.currentCompany, companyUrn ?? undefined);
          if (resolved) {
            if (resolved.domain) person.companyDomain = resolved.domain;
            person.companyLinkedInSlug = companySlug;
            person.companyMetadata = resolved.companyMetadata;
          }
        } catch {
        }
      }

      // Step 4: If domain resolver failed, fall back to website URL from profile position data
      const BLOCKED_DOMAINS = ['linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com', 'x.com', 'youtube.com', 'tiktok.com'];
      if (!person.companyDomain && companyWebsiteUrl) {
        try {
          const parsed = new URL(companyWebsiteUrl.startsWith('http') ? companyWebsiteUrl : `https://${companyWebsiteUrl}`);
          let hostname = parsed.hostname;
          if (hostname.startsWith('www.')) hostname = hostname.slice(4);
          if (!BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
            person.companyDomain = hostname;
          }
        } catch {
        }
      }

      // Always store the LinkedIn slug if we have one
      if (!person.companyLinkedInSlug && companySlug) {
        person.companyLinkedInSlug = companySlug;
      }

      this.scrapedPersons.push(person);

      const withDomain = this.scrapedPersons.filter((p) => p.companyDomain).length;
      this.updateProgress('scraping', {
        scraped: i + 1,
        total: parsed.length,
        withDomain,
      });

      await rateLimiter.wait();
    }

    this.updateProgress('done');
  }

  private extractCompanySlug(companyName: string): string | null {
    const normalized = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || null;
  }

  private parseError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        return 'Session expired - please log in to LinkedIn again';
      }
      if (error.message.includes('429')) {
        return 'Rate limited by LinkedIn - please wait and try again';
      }
      if (error.message.includes('JSESSIONID')) {
        return 'Not logged in to LinkedIn - please log in first';
      }
      return error.message;
    }
    return 'Unknown error occurred';
  }

  stopScrape(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.updateProgress('paused');
    }
  }

  getProgress(): ScrapeProgress {
    return this.currentProgress;
  }

  async exportData(): Promise<void> {
    if (this.scrapedPersons.length === 0) {
      throw new Error('No data to export');
    }

    const jsonl = buildJsonl(this.scrapedPersons, this.currentProgress.mode);
    const filename = generateFilename(this.currentProgress.mode);
    triggerDownload(jsonl, filename);

    this.scrapedPersons = [];
    this.currentProgress = {
      mode: this.currentProgress.mode,
      scraped: 0,
      withDomain: 0,
      status: 'idle',
    };
    await this.clearSession();
    await this.broadcastProgress();
  }

  async getCacheStats(): Promise<CacheStats> {
    return this.domainCache.getStats();
  }

  async getAdminCompanies(): Promise<AdminCompany[]> {
    const tabId = await findLinkedInTabId();
    const proxyFetch = createProxyFetch(tabId);
    const csrfToken = await getCSRFToken();
    const client = new VoyagerClient(csrfToken, proxyFetch);

    const response = await client.fetch<Record<string, unknown>>(ENDPOINTS.ADMIN_COMPANIES, {
      ...ADMIN_COMPANIES_PARAMS,
    });

    interface CompanyElement {
      name?: string;
      universalName?: string;
      entityUrn?: string;
    }

    const elements = (response as { elements?: CompanyElement[] }).elements
      ?? (response as { data?: { elements?: CompanyElement[] } }).data?.elements
      ?? [];

    return elements
      .filter((el): el is CompanyElement & { name: string; entityUrn: string } =>
        Boolean(el.name && el.entityUrn)
      )
      .map((el) => {
        const idMatch = el.entityUrn.match(/:(\d+)$/);
        return {
          name: el.name,
          id: idMatch?.[1] ?? '',
          universalName: el.universalName ?? '',
        };
      })
      .filter((c) => c.id !== '');
  }
}

const orchestrator = new ScrapeOrchestrator();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message as MessageType;

  (async () => {
    try {
      if (msg.type === 'START_SCRAPE') {
        await orchestrator.startScrape(msg.mode, msg.companySlug, msg.manualListText);
        sendResponse({ success: true });
      } else if (msg.type === 'STOP_SCRAPE') {
        orchestrator.stopScrape();
        sendResponse({ success: true });
      } else if (msg.type === 'GET_PROGRESS') {
        const progress = orchestrator.getProgress();
        const response: MessageType = { type: 'PROGRESS_UPDATE', progress };
        sendResponse(response);
      } else if (msg.type === 'EXPORT_DATA') {
        await orchestrator.exportData();
        sendResponse({ success: true });
      } else if (msg.type === 'GET_CACHE_STATS') {
        const stats = await orchestrator.getCacheStats();
        const response: MessageType = { type: 'CACHE_STATS', stats };
        sendResponse(response);
      } else if (msg.type === 'GET_ADMIN_COMPANIES') {
        const companies = await orchestrator.getAdminCompanies();
        const response: MessageType = { type: 'ADMIN_COMPANIES', companies };
        sendResponse(response);
      } else if (msg.type === 'PAGE_CONTEXT') {
        sendResponse({ success: true });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

  return true;
});
