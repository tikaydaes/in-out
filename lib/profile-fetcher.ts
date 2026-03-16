import type { VoyagerClient } from './voyager-client.js';
import type { Education } from './types.js';
import { ENDPOINTS, DECORATION_IDS, VOYAGER_BASE } from './constants.js';

export interface ProfileData {
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  summary: string | null;
  location: string | null;
  industry: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  companyUniversalName: string | null;
  companyUrn: string | null;
  companyWebsiteUrl: string | null;
  publicIdentifier: string | null;
  skills: string[];
  educations: Education[];
  languages: string[];
}

interface ProfileElement {
  firstName?: string;
  lastName?: string;
  headline?: string;
  publicIdentifier?: string;
  entityUrn?: string;
  experienceCardUrn?: string;
  geoLocationBackfilled?: { geo?: { defaultLocalizedName?: string } };
  geoLocation?: { geo?: { defaultLocalizedName?: string } };
  locationName?: string;
  location?: string;
}

interface ExperienceResult {
  title: string | null;
  company: string | null;
  companySlug: string | null;
  companyUrn: string | null;
  companyWebsiteUrl: string | null;
}

interface RichProfileFields {
  summary: string | null;
  industry: string | null;
  skills: string[];
  educations: Education[];
  languages: string[];
}

interface EnrichedResult {
  experience: ExperienceResult | null;
  richData: RichProfileFields;
}

const EMPTY_RICH_DATA: RichProfileFields = {
  summary: null,
  industry: null,
  skills: [],
  educations: [],
  languages: [],
};

export async function fetchFullProfile(
  client: VoyagerClient,
  memberIdentifier: string,
): Promise<ProfileData | null> {
  let profile: ProfileElement | null = null;

  try {
    const response = await client.fetch<Record<string, unknown>>(ENDPOINTS.PROFILE, {
      q: 'memberIdentity',
      memberIdentity: memberIdentifier,
      decorationId: DECORATION_IDS.PROFILE_TOP_CARD,
    });

    const elements = (response as { elements?: ProfileElement[] }).elements;
    profile = elements?.[0] ?? null;
  } catch {
  }

  if (!profile) {
    return null;
  }

  const location = profile.geoLocationBackfilled?.geo?.defaultLocalizedName
    ?? profile.geoLocation?.geo?.defaultLocalizedName
    ?? profile.locationName
    ?? profile.location
    ?? null;

  const realPublicId = profile.publicIdentifier ?? null;
  const profileUrn = profile.entityUrn ?? null;

  const enriched = await fetchEnrichedData(client, memberIdentifier, realPublicId, profileUrn);

  const result: ProfileData = {
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    headline: profile.headline ?? null,
    summary: enriched.richData.summary,
    location,
    industry: enriched.richData.industry,
    currentTitle: enriched.experience?.title ?? null,
    currentCompany: enriched.experience?.company ?? null,
    companyUniversalName: enriched.experience?.companySlug ?? null,
    companyUrn: enriched.experience?.companyUrn ?? null,
    companyWebsiteUrl: enriched.experience?.companyWebsiteUrl ?? null,
    publicIdentifier: realPublicId,
    skills: enriched.richData.skills,
    educations: enriched.richData.educations,
    languages: enriched.richData.languages,
  };

  return result;
}

async function fetchEnrichedData(
  client: VoyagerClient,
  memberIdentifier: string,
  publicIdentifier: string | null,
  profileUrn: string | null,
): Promise<EnrichedResult> {
  const idToUse = publicIdentifier ?? memberIdentifier;

  // FullProfileWithEntities decorations return positions AND rich profile data
  const fullProfileDecorations = [
    'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
    'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-100',
    'com.linkedin.voyager.dash.deco.identity.profile.TopCardSupplementary-126',
    'com.linkedin.voyager.dash.deco.identity.profile.TopCardSupplementary-132',
  ];

  for (const decorationId of fullProfileDecorations) {
    try {
      const response = await client.fetch<Record<string, unknown>>(ENDPOINTS.PROFILE, {
        q: 'memberIdentity',
        memberIdentity: idToUse,
        decorationId,
      });
      const result = extractFromFullProfileResponse(response);
      if (result.experience) return result;
    } catch {
    }
  }

  // Position-only fallbacks (no rich profile data available from these)
  if (profileUrn) {
    const fsdProfileUrn = profileUrn.includes('fsd_profile')
      ? profileUrn
      : `urn:li:fsd_profile:${memberIdentifier}`;

    const positionDecorations = [
      'com.linkedin.voyager.dash.deco.identity.profile.ProfilePositionGroup-40',
      'com.linkedin.voyager.dash.deco.identity.profile.ProfilePositionGroup-52',
    ];

    for (const decorationId of positionDecorations) {
      try {
        const response = await client.fetch<Record<string, unknown>>(
          '/identity/dash/profilePositionGroups',
          {
            q: 'viewee',
            profileUrn: fsdProfileUrn,
            decorationId,
          },
        );
        const experience = extractFromPositionGroups(response);
        if (experience) return { experience, richData: EMPTY_RICH_DATA };
      } catch {
      }
    }
  }

  // GraphQL fallback
  try {
    const url = `${VOYAGER_BASE}/graphql?variables=(profileUrn:urn%3Ali%3Afsd_profile%3A${encodeURIComponent(memberIdentifier)},sectionType:experience,locale:en_US)&queryId=voyagerIdentityDashProfileCards.5765898654977801`;
    const response = await client.fetchFullUrl<Record<string, unknown>>(url);
    const experience = extractFromGraphqlCards(response);
    if (experience) return { experience, richData: EMPTY_RICH_DATA };
  } catch {
  }

  return { experience: null, richData: EMPTY_RICH_DATA };
}

function extractFromFullProfileResponse(
  response: Record<string, unknown>,
): EnrichedResult {
  const elements = (response as { elements?: Array<Record<string, unknown>> }).elements
    ?? (response as { data?: { elements?: Array<Record<string, unknown>> } }).data?.elements;

  const profile = elements?.[0];
  if (!profile) return { experience: null, richData: EMPTY_RICH_DATA };

  // Extract rich profile data from the same response
  const richData = extractRichProfileData(profile);

  // Try positions from included entities
  const included = (response as { included?: Array<Record<string, unknown>> }).included;
  if (included?.length) {
    const positionEntities = included.filter(
      (e) => {
        const type = (e as { '$type'?: string })['$type'] ?? '';
        return type.includes('Position') || type.includes('position');
      }
    );
    if (positionEntities.length > 0) {
      const experience = extractFromIncludedPosition(positionEntities[0]);
      if (experience) return { experience, richData };
    }
  }

  // Try profileTopPosition
  const topPosition = profile.profileTopPosition as { elements?: Array<Record<string, unknown>> } | undefined;
  if (topPosition?.elements?.length) {
    const experience = extractFromPositionElement(topPosition.elements[0]);
    if (experience) return { experience, richData };
  }

  // Try profilePositionGroups inline
  const positionGroups = profile.profilePositionGroups as { elements?: Array<Record<string, unknown>> } | undefined;
  if (positionGroups?.elements?.length) {
    const firstGroup = positionGroups.elements[0] as {
      profilePositionInPositionGroup?: { elements?: Array<Record<string, unknown>> };
    };
    const positions = firstGroup?.profilePositionInPositionGroup?.elements;
    if (positions?.length) {
      const experience = extractFromPositionElement(positions[0]);
      if (experience) return { experience, richData };
    }
  }

  // Even if we couldn't extract positions, return rich data if we got any
  if (richData.summary || richData.skills.length > 0 || richData.educations.length > 0) {
    return { experience: null, richData };
  }

  return { experience: null, richData: EMPTY_RICH_DATA };
}

function extractRichProfileData(profile: Record<string, unknown>): RichProfileFields {
  const summary = (profile.summary as string) ?? null;

  // industry can be a string or a resolved object with a .name property
  const rawIndustry = profile.industry;
  const industry = typeof rawIndustry === 'string'
    ? rawIndustry
    : (rawIndustry as { name?: string } | null)?.name ?? null;

  const skills = extractSkills(profile.profileSkills);
  const educations = extractEducations(profile.profileEducations);
  const languages = extractLanguages(profile.profileLanguages);

  return { summary, industry, skills, educations, languages };
}

function extractSkills(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const container = raw as { elements?: Array<Record<string, unknown>> };
  if (!container.elements?.length) return [];

  return container.elements
    .map(el => (el.name as string) ?? null)
    .filter((name): name is string => !!name);
}

function extractEducations(raw: unknown): Education[] {
  if (!raw || typeof raw !== 'object') return [];
  const container = raw as { elements?: Array<Record<string, unknown>> };
  if (!container.elements?.length) return [];

  return container.elements
    .map(el => {
      const school = (el.schoolName as string) ?? (el.school as string) ?? null;
      if (!school) return null;
      return {
        school,
        degree: (el.degreeName as string) ?? (el.degree as string) ?? null,
        field: (el.fieldOfStudy as string) ?? (el.field as string) ?? null,
      };
    })
    .filter((e): e is Education => e !== null);
}

function extractLanguages(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const container = raw as { elements?: Array<Record<string, unknown>> };
  if (!container.elements?.length) return [];

  return container.elements
    .map(el => (el.name as string) ?? null)
    .filter((name): name is string => !!name);
}

function extractFromPositionGroups(response: Record<string, unknown>): ExperienceResult | null {
  const elements = (response as { elements?: Array<Record<string, unknown>> }).elements
    ?? (response as { data?: { elements?: Array<Record<string, unknown>> } }).data?.elements;

  if (!elements?.length) return null;

  const firstGroup = elements[0] as {
    profilePositionInPositionGroup?: { elements?: Array<Record<string, unknown>> };
    name?: string;
    companyName?: string;
    company?: Record<string, unknown>;
  };

  const positions = firstGroup?.profilePositionInPositionGroup?.elements;
  if (positions?.length) {
    return extractFromPositionElement(positions[0]);
  }

  if (firstGroup.companyName || firstGroup.company) {
    return extractFromPositionElement(firstGroup as Record<string, unknown>);
  }

  return null;
}

function extractFromGraphqlCards(_response: Record<string, unknown>): ExperienceResult | null {
  return null;
}

function extractFromPositionElement(pos: Record<string, unknown>): ExperienceResult | null {
  const title = (pos.title as string) ?? null;
  const companyName = (pos.companyName as string) ?? null;
  const company = pos.company as Record<string, unknown> | undefined;
  const companySlug = (company?.universalName as string) ?? null;
  const companyUrn = (pos.companyUrn as string) ?? (company?.entityUrn as string) ?? null;
  // company.url is the LinkedIn company page URL, NOT the actual website
  const companyWebsiteUrl = (company?.websiteUrl as string) ?? null;

  return {
    title,
    company: companyName ?? (company?.name as string) ?? null,
    companySlug,
    companyUrn,
    companyWebsiteUrl,
  };
}

function extractFromIncludedPosition(pos: Record<string, unknown>): ExperienceResult | null {
  const title = (pos.title as string) ?? null;
  const companyName = (pos.companyName as string) ?? null;
  const company = pos.company as Record<string, unknown> | undefined;

  let companySlug: string | null = null;
  const companyUrn = (pos.companyUrn as string) ?? (company?.entityUrn as string) ?? null;
  const companyWebsiteUrl = (company?.websiteUrl as string) ?? null;

  if (company?.universalName) {
    companySlug = company.universalName as string;
  } else if (companyUrn) {
    const idMatch = companyUrn.match(/fsd_company:(\d+)/);
    if (idMatch) companySlug = idMatch[1];
  }

  const companyUrl = (pos['companyUrl'] as string) ?? (pos['url'] as string) ?? null;
  if (!companySlug && companyUrl) {
    const slugMatch = companyUrl.match(/\/company\/([^/?#]+)/);
    if (slugMatch) companySlug = slugMatch[1];
  }

  return {
    title,
    company: companyName ?? (company?.name as string) ?? null,
    companySlug,
    companyUrn,
    companyWebsiteUrl,
  };
}
