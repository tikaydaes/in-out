import type { ScrapedPerson, CompanyMetadata, ExportMetadata, ScrapeMode } from './types.js';

export function buildJsonl(
  persons: ScrapedPerson[],
  mode: ScrapeMode
): string {
  const meta: ExportMetadata = {
    exportedAt: new Date().toISOString(),
    source: mode,
    totalScraped: persons.length,
    totalWithDomain: persons.filter((p) => p.companyDomain).length,
    extensionVersion: chrome.runtime.getManifest().version,
  };

  // Deduplicate companies by slug (or by name if no slug)
  const companyMap = new Map<string, CompanyMetadata>();
  for (const person of persons) {
    if (!person.companyMetadata) continue;
    const key = person.companyMetadata.slug || person.companyMetadata.name;
    if (!companyMap.has(key)) {
      companyMap.set(key, person.companyMetadata);
    }
  }

  const lines: string[] = [
    JSON.stringify({ type: '_meta', data: meta }),
  ];

  for (const [, company] of companyMap) {
    lines.push(JSON.stringify({ type: 'company', data: company }));
  }

  for (const person of persons) {
    const { companyMetadata: _excluded, ...personData } = person;
    lines.push(JSON.stringify({ type: 'person', data: personData }));
  }

  return lines.join('\n') + '\n';
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function triggerDownload(jsonl: string, filename: string): void {
  const dataUrl = `data:application/x-ndjson;base64,${toBase64(jsonl)}`;
  chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
}

export function generateFilename(mode: ScrapeMode): string {
  const now = new Date();
  const date = now
    .toISOString()
    .slice(0, 16)
    .replace('T', '-')
    .replace(':', '');
  return `linkedin-${mode}-${date}.jsonl`;
}
