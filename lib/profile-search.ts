import { VOYAGER_BASE, GRAPHQL_QUERY_IDS } from './constants.js';
import type { VoyagerClient } from './voyager-client.js';
import type { ScrapedPerson } from './types.js';
import { parseHeadline } from './scrape-utils.js';

interface TypeaheadElement {
  suggestionType?: string;
  entityLockupView?: {
    title?: { text?: string };
    subtitle?: { text?: string };
    navigationUrl?: string;
    trackingUrn?: string;
  };
}

interface TypeaheadResponse {
  data?: {
    searchDashTypeaheadByGlobalTypeahead?: {
      elements?: TypeaheadElement[];
    };
  };
}

export async function searchProfile(
  client: VoyagerClient,
  firstName: string,
  lastName: string,
  company?: string
): Promise<ScrapedPerson | null> {
  const query = `${firstName} ${lastName}${company ? ` ${company}` : ''}`.trim();
  const url = `${VOYAGER_BASE}/graphql?variables=(query:${encodeURIComponent(query)})&queryId=${GRAPHQL_QUERY_IDS.TYPEAHEAD}`;

  const rawResponse = await client.fetchFullUrl<Record<string, unknown>>(url);
  const response = rawResponse as unknown as TypeaheadResponse;
  const elements = response.data?.searchDashTypeaheadByGlobalTypeahead?.elements ?? [];

  const personSuggestions = elements.filter(
    (el) => el.suggestionType && el.suggestionType.includes('TYPEAHEAD')
  );

  if (personSuggestions.length === 0) {
    return null;
  }

  let bestMatch = personSuggestions[0];

  if (company && personSuggestions.length > 1) {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const companyNorm = normalize(company);
    let bestScore = 0;

    for (const suggestion of personSuggestions) {
      const subtitleNorm = normalize(suggestion.entityLockupView?.subtitle?.text || '');

      if (subtitleNorm.includes(companyNorm)) {
        bestMatch = suggestion;
        break;
      }

      const companyWords = companyNorm.split(/\s+/).filter(w => w.length > 2);
      const matchedWords = companyWords.filter(w => subtitleNorm.includes(w));
      const score = companyWords.length > 0 ? matchedWords.length / companyWords.length : 0;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = suggestion;
      }
    }
  }

  if (!bestMatch?.entityLockupView) {
    return null;
  }

  const view = bestMatch.entityLockupView;
  const subtitle = view.subtitle?.text || '';
  const navUrl = view.navigationUrl || '';
  const trackingUrn = view.trackingUrn || '';

  const cleanSubtitle = subtitle.replace(/^•\s*\d+(st|nd|rd|th)?\s*•\s*/i, '');

  const publicIdMatch = navUrl.match(/\/in\/([^/?]+)/);
  const publicIdentifier = publicIdMatch ? publicIdMatch[1] : undefined;

  const profileName = view.title?.text || '';
  const nameParts = profileName.split(/\s+/);

  const result: ScrapedPerson = {
    firstName: nameParts[0] || firstName,
    lastName: nameParts.slice(1).join(' ') || lastName,
  };

  if (cleanSubtitle) {
    result.headline = cleanSubtitle;
    const parsed = parseHeadline(cleanSubtitle);
    if (parsed.title) result.currentTitle = parsed.title;
    if (parsed.company) result.currentCompany = parsed.company;
  }

  if (publicIdentifier) {
    result.profileUrl = `https://www.linkedin.com/in/${publicIdentifier}`;
  }

  if (trackingUrn) {
    result.entityUrn = trackingUrn;
  }

  return result;
}
