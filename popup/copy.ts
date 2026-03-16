import type { ScrapeMode } from '../lib/types';

export const CONSENT_COPY = {
  heading: 'Understand the risks before proceeding',
  intro: 'This tool exports data from LinkedIn by accessing its internal API. Using it violates LinkedIn\'s Terms of Service. There is no company or entity behind this tool — you accept all risk.',
  sections: [
    {
      title: 'LinkedIn Terms of Service violation',
      items: [
        'This tool violates LinkedIn\'s User Agreement (Section 8.2), which prohibits scraping via extensions or automated tools',
        'Your LinkedIn account may be restricted, suspended, or permanently banned',
        'LinkedIn may pursue legal action against users of scraping tools',
      ],
    },
    {
      title: 'Third-party data you will collect',
      items: [
        'Names, job titles, employers, locations, skills, and education of other LinkedIn users',
        'You become the sole data controller for all exported personal information',
        'Privacy laws (GDPR, Australian Privacy Act, etc.) may impose obligations on how you handle, store, and dispose of this data',
      ],
    },
    {
      title: 'Data storage and security',
      items: [
        'All data stays in your browser — nothing is sent to any external server',
        'Cached data in chrome.storage.local is not encrypted and is readable by other extensions or processes with access to your browser profile',
        'Exported JSONL files are plain text — you are responsible for encrypting and securing them if you transfer them off your machine',
      ],
    },
    {
      title: 'No warranty, no support, no liability',
      items: [
        'This tool is provided as-is with no warranty of any kind',
        'No entity accepts liability for damages, data loss, account suspension, or legal claims arising from your use',
        'You use this tool entirely at your own risk',
      ],
    },
  ],
  privacyLink: 'Read the full privacy and data disclosure',
  acceptButton: 'I Accept All Risks and Responsibilities',
} as const;

export const COPY = {
  status: {
    idle: 'Ready to export',
    starting: 'Starting export...',
    paused: 'Export paused',
    complete: (count: number) => `Export complete! ${count} records ready`,
  },

  progress: {
    connections: (scraped: number, total?: number) =>
      total ? `Exporting connections... ${scraped} of ${total}` : `Exporting connections... ${scraped}`,
    'company-followers': (scraped: number, total?: number) =>
      total ? `Exporting company followers... ${scraped} of ${total}` : `Exporting company followers... ${scraped}`,
    followers: (scraped: number, total?: number) =>
      total ? `Exporting followers... ${scraped} of ${total}` : `Exporting followers... ${scraped}`,
    following: (scraped: number, total?: number) =>
      total ? `Exporting following... ${scraped} of ${total}` : `Exporting following... ${scraped}`,
    'manual-list': (scraped: number, total?: number) =>
      total ? `Processing list... ${scraped} of ${total}` : `Processing list... ${scraped}`,
  },

  stats: (scraped: number, total: number | undefined, withDomain: number) =>
    total
      ? `${scraped} of ${total} scraped • ${withDomain} domains resolved`
      : `${scraped} scraped • ${withDomain} domains resolved`,

  exportCount: (count: number) => `${count} records ready to export`,

  cacheStats: (count: number) => `${count} domains cached`,

  statusIndicator: {
    ready: '• Ready',
    exporting: '• Exporting...',
    error: '• Error',
    complete: '• Complete',
    processing: '• Processing...',
  },

  errors: {
    sessionExpired: 'Session expired. Please refresh LinkedIn and try again.',
    rateLimited: 'Rate limited by LinkedIn. Please wait a few minutes and try again.',
    networkError: 'Network error. Please check your connection and try again.',
    noCompanySlug: 'Please select a company or enter a company ID.',
    noResults: 'No results found. This may be a private profile or empty list.',
    emptyManualList: 'Please enter at least one name and company.',
    invalidManualListFormat: 'Invalid format. Enter one person per line as: Name, Company',
    generic: (details: string) => `Something went wrong: ${details}`,
  },

  modeLabels: {
    connections: 'My Connections',
    'company-followers': 'Company Followers',
    followers: 'My Followers',
    following: 'People I Follow',
    'manual-list': 'Manual List',
  },

  manualList: {
    placeholder: 'One person per line: Name, Company\n\nExample:\nJohn Smith, Microsoft\nJane Doe, Google\nBob Jones, Amazon',
  },
} as const;

export function getProgressMessage(mode: ScrapeMode, scraped: number, total?: number): string {
  return COPY.progress[mode](scraped, total);
}

export function getStatsText(scraped: number, total: number | undefined, withDomain: number): string {
  return COPY.stats(scraped, total, withDomain);
}
