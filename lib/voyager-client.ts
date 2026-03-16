import { VOYAGER_BASE, PAGE_SIZE } from './constants.js';
import type { VoyagerPaging } from './types.js';

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export class VoyagerClient {
  private csrfToken: string;
  private fetchFn: FetchFn;

  constructor(csrfToken: string, fetchFn?: FetchFn) {
    this.csrfToken = csrfToken;
    this.fetchFn = fetchFn || globalThis.fetch.bind(globalThis);
  }

  private get headers(): HeadersInit {
    return {
      'csrf-token': this.csrfToken,
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'x-li-track': JSON.stringify({
        clientVersion: '1.13.8',
        mpVersion: '1.13.8',
        osName: 'web',
        timezoneOffset: -5,
        timezone: 'America/New_York',
        deviceFormFactor: 'DESKTOP',
        mpName: 'voyager-web',
      }),
    };
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${VOYAGER_BASE}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  async fetch<T>(path: string, params?: Record<string, string>): Promise<T> {
    const response = await this.fetchFn(this.buildUrl(path, params), {
      method: 'GET',
      headers: this.headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Voyager API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async fetchFullUrl<T>(url: string): Promise<T> {
    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: this.headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Voyager API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async *paginate<T>(
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal,
  ): AsyncGenerator<{ elements: T[]; paging: VoyagerPaging }> {
    let start = 0;

    while (true) {
      if (signal?.aborted) break;

      const paginatedParams = {
        ...params,
        start: start.toString(),
        count: PAGE_SIZE.toString(),
      };

      const response = await this.fetchFn(this.buildUrl(path, paginatedParams), {
        method: 'GET',
        headers: this.headers,
        credentials: 'include',
        signal,
      });

      if (!response.ok) {
        throw new Error(`Voyager API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      const elements: T[] = json.elements ?? json.data?.elements ?? [];
      const rawPaging = json.paging ?? {};
      const paging: VoyagerPaging = {
        start: rawPaging.start ?? start,
        count: rawPaging.count ?? elements.length,
        total: rawPaging.total,
      };

      yield { elements, paging };

      if (elements.length < PAGE_SIZE) break;

      start += PAGE_SIZE;
    }
  }
}
