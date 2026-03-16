import type { ScrapedPerson } from './types.js';
import type { VoyagerClient } from './voyager-client.js';
import { VOYAGER_BASE, GRAPHQL_QUERY_IDS, SEARCH_CLUSTERS_PAGE_SIZE } from './constants.js';
import { RateLimiter } from './rate-limiter.js';
import { parseHeadline } from './scrape-utils.js';

export type FollowDirection = 'FOLLOWERS' | 'FOLLOWING';

interface SearchClusterElement {
  item?: {
    entityResult?: {
      entityUrn?: string;
      title?: { text?: string };
      primarySubtitle?: { text?: string };
      navigationUrl?: string;
    };
  };
}

interface SearchClustersResponse {
  data?: {
    searchDashClustersByAll?: {
      elements?: Array<{
        items?: SearchClusterElement[];
      }>;
      paging?: {
        start: number;
        count: number;
        total?: number;
      };
    };
  };
}

function buildSearchClustersUrl(direction: FollowDirection, start: number, count: number): string {
  const variables = `(start:${start},count:${count},origin:CurationHub,query:(flagshipSearchIntent:MYNETWORK_CURATION_HUB,includeFiltersInResponse:true,queryParameters:List((key:resultType,value:List(${direction})))))`;
  return `${VOYAGER_BASE}/graphql?includeWebMetadata=true&variables=${variables}&queryId=${GRAPHQL_QUERY_IDS.SEARCH_CLUSTERS}`;
}

function extractPublicIdentifier(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/in\/([^/?]+)/);
  return match?.[1];
}

export async function* scrapeFollows(
  client: VoyagerClient,
  direction: FollowDirection,
  signal?: AbortSignal,
  onProgress?: (scraped: number, total?: number) => void,
): AsyncGenerator<ScrapedPerson[]> {
  const rateLimiter = new RateLimiter();
  let totalScraped = 0;
  let start = 0;
  const count = SEARCH_CLUSTERS_PAGE_SIZE;

  while (true) {
    if (signal?.aborted) return;

    const url = buildSearchClustersUrl(direction, start, count);
    const response = await client.fetchFullUrl<SearchClustersResponse>(url);
    const data = response.data?.searchDashClustersByAll;
    const clusters = data?.elements ?? [];

    const allItems: SearchClusterElement[] = clusters.flatMap((cluster) => cluster.items ?? []);

    if (allItems.length === 0) return;

    const people: ScrapedPerson[] = [];

    for (const item of allItems) {
      const entityResult = item.item?.entityResult;
      if (!entityResult) continue;

      const name = entityResult.title?.text ?? '';
      const [firstName, ...lastNameParts] = name.split(/\s+/);
      if (!firstName) continue;

      const headline = entityResult.primarySubtitle?.text;
      const { title, company } = headline
        ? parseHeadline(headline)
        : { title: undefined, company: undefined };

      const publicIdentifier = extractPublicIdentifier(entityResult.navigationUrl);

      people.push({
        firstName,
        lastName: lastNameParts.join(' '),
        headline,
        currentTitle: title,
        currentCompany: company,
        profileUrl: publicIdentifier
          ? `https://www.linkedin.com/in/${publicIdentifier}`
          : undefined,
        entityUrn: entityResult.entityUrn,
      });
    }

    totalScraped += people.length;
    onProgress?.(totalScraped);

    yield people;

    if (allItems.length < count) return;

    start += count;
    await rateLimiter.wait();
  }
}
