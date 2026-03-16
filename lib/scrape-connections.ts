import type { ScrapedPerson } from './types.js';
import type { VoyagerClient } from './voyager-client.js';
import { ENDPOINTS, DECORATION_IDS } from './constants.js';
import { RateLimiter } from './rate-limiter.js';
import { parseHeadline } from './scrape-utils.js';

interface ConnectionElement {
  connectedMemberResolutionResult?: {
    firstName?: string;
    lastName?: string;
    headline?: string;
    publicIdentifier?: string;
    entityUrn?: string;
  };
}

export async function* scrapeConnections(
  client: VoyagerClient,
  signal?: AbortSignal,
  onProgress?: (scraped: number, total?: number) => void,
): AsyncGenerator<ScrapedPerson[]> {
  const rateLimiter = new RateLimiter();
  let totalScraped = 0;

  const params = {
    decorationId: DECORATION_IDS.CONNECTIONS,
    q: 'search',
    sortType: 'RECENTLY_ADDED',
  };

  for await (const { elements, paging } of client.paginate<ConnectionElement>(
    ENDPOINTS.CONNECTIONS,
    params,
    signal,
  )) {
    if (signal?.aborted) return;

    const people: ScrapedPerson[] = [];

    for (const element of elements) {
      const member = element.connectedMemberResolutionResult;
      if (!member) continue;

      const { title, company } = member.headline
        ? parseHeadline(member.headline)
        : { title: undefined, company: undefined };

      people.push({
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        headline: member.headline,
        currentTitle: title,
        currentCompany: company,
        profileUrl: member.publicIdentifier
          ? `https://www.linkedin.com/in/${member.publicIdentifier}`
          : undefined,
        entityUrn: member.entityUrn,
      });
    }

    totalScraped += people.length;
    onProgress?.(totalScraped, paging.total);

    yield people;

    await rateLimiter.wait();
  }
}
