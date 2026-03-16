import type { CompanyDomainEntry, CompanyMetadata, CacheStats } from './types.js';
import { DOMAIN_CACHE_TTL_MS, DOMAIN_CACHE_PREFIX } from './constants.js';

export class DomainCache {
  async get(companySlug: string): Promise<{ domain: string; companyMetadata?: CompanyMetadata } | null> {
    const key = DOMAIN_CACHE_PREFIX + companySlug;
    const result = await chrome.storage.local.get(key);
    const entry: CompanyDomainEntry | undefined = result[key];

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.resolvedAt;
    if (age > DOMAIN_CACHE_TTL_MS) {
      await chrome.storage.local.remove(key);
      return null;
    }

    return { domain: entry.domain, companyMetadata: entry.companyMetadata };
  }

  async set(
    companySlug: string,
    domain: string,
    source: CompanyDomainEntry['source'],
    companyMetadata?: CompanyMetadata
  ): Promise<void> {
    const key = DOMAIN_CACHE_PREFIX + companySlug;
    const entry: CompanyDomainEntry = {
      domain,
      resolvedAt: Date.now(),
      source,
      companyMetadata,
    };
    await chrome.storage.local.set({ [key]: entry });
  }

  async getStats(): Promise<CacheStats> {
    const allItems = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(allItems).filter((key) =>
      key.startsWith(DOMAIN_CACHE_PREFIX)
    );

    if (cacheKeys.length === 0) {
      return { totalCached: 0, oldestEntry: null };
    }

    let oldestTimestamp = Date.now();
    for (const key of cacheKeys) {
      const entry: CompanyDomainEntry = allItems[key];
      if (entry.resolvedAt < oldestTimestamp) {
        oldestTimestamp = entry.resolvedAt;
      }
    }

    return {
      totalCached: cacheKeys.length,
      oldestEntry: oldestTimestamp,
    };
  }

  async clear(): Promise<void> {
    const allItems = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(allItems).filter((key) =>
      key.startsWith(DOMAIN_CACHE_PREFIX)
    );
    await chrome.storage.local.remove(cacheKeys);
  }
}
