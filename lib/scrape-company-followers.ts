import type { ScrapedPerson } from './types.js';
import type { VoyagerClient } from './voyager-client.js';
import { VOYAGER_BASE, GRAPHQL_QUERY_IDS, COMPANY_FOLLOWERS_PAGE_SIZE } from './constants.js';
import { RateLimiter } from './rate-limiter.js';
import { parseHeadline } from './scrape-utils.js';

interface FollowerProfile {
  firstName?: string;
  lastName?: string;
  headline?: string;
  publicIdentifier?: string;
  entityUrn?: string;
}

interface FollowerElement {
  followerV2?: {
    profile?: FollowerProfile;
  };
  followedAt?: {
    text?: string;
  };
}

interface CompanyFollowersResponse {
  data: {
    organizationDashFollowersByOrganizationalPage: {
      elements: FollowerElement[];
      paging: { start: number; count: number; total: number };
    };
  };
}

function buildFollowersUrl(companyId: string, start: number, count: number): string {
  const orgUrn = `urn%3Ali%3Afsd_organizationalPage%3A${companyId}`;
  const variables = `(start:${start},count:${count},organizationalPage:${orgUrn},followerType:MEMBER)`;
  return `${VOYAGER_BASE}/graphql?includeWebMetadata=true&variables=${variables}&queryId=${GRAPHQL_QUERY_IDS.COMPANY_FOLLOWERS}`;
}

export async function* scrapeCompanyFollowers(
  client: VoyagerClient,
  companyId: string,
  signal?: AbortSignal,
  onProgress?: (scraped: number, total?: number) => void,
): AsyncGenerator<ScrapedPerson[]> {
  const rateLimiter = new RateLimiter();
  let totalScraped = 0;
  let start = 0;
  const count = COMPANY_FOLLOWERS_PAGE_SIZE;

  while (true) {
    if (signal?.aborted) return;

    const url = buildFollowersUrl(companyId, start, count);
    const response = await client.fetchFullUrl<CompanyFollowersResponse>(url);
    const data = response.data?.organizationDashFollowersByOrganizationalPage;
    const elements = data?.elements ?? [];

    if (elements.length === 0) return;

    const people: ScrapedPerson[] = [];

    for (const element of elements) {
      const profile = element.followerV2?.profile;
      if (!profile?.firstName) continue;

      const { title, company } = profile.headline
        ? parseHeadline(profile.headline)
        : { title: undefined, company: undefined };

      people.push({
        firstName: profile.firstName,
        lastName: profile.lastName ?? '',
        headline: profile.headline,
        currentTitle: title,
        currentCompany: company,
        profileUrl: profile.publicIdentifier
          ? `https://www.linkedin.com/in/${profile.publicIdentifier}`
          : undefined,
        entityUrn: profile.entityUrn,
      });
    }

    totalScraped += people.length;
    onProgress?.(totalScraped);

    yield people;

    if (elements.length < count) return;

    start += count;
    await rateLimiter.wait();
  }
}
