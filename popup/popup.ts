import type { MessageType, ScrapeMode, ScrapeProgress, CacheStats, PageContext, AdminCompany } from '../lib/types.js';
import { CONSENT_STORAGE_KEY, PRIVACY_POLICY_VERSION } from '../lib/constants.js';
import { COPY, CONSENT_COPY, getProgressMessage, getStatsText } from './copy.js';

const MANUAL_ENTRY_VALUE = '__manual__';

const consentGate = document.getElementById('consent-gate') as HTMLDivElement;
const mainApp = document.getElementById('main-app') as HTMLDivElement;
const consentHeading = document.getElementById('consent-heading') as HTMLHeadingElement;
const consentIntro = document.getElementById('consent-intro') as HTMLParagraphElement;
const consentSections = document.getElementById('consent-sections') as HTMLDivElement;
const consentPrivacyLink = document.getElementById('consent-privacy-link') as HTMLAnchorElement;
const consentAcceptBtn = document.getElementById('consent-accept-btn') as HTMLButtonElement;
const consentVersionBadge = document.getElementById('consent-version-badge') as HTMLSpanElement;

const modeSelect = document.getElementById('mode-select') as HTMLSelectElement;
const companySelect = document.getElementById('company-select') as HTMLSelectElement;
const companyInput = document.getElementById('company-input') as HTMLInputElement;
const companySection = document.getElementById('company-section') as HTMLDivElement;
const manualCompanySection = document.getElementById('manual-company-section') as HTMLDivElement;
const manualListSection = document.getElementById('manual-list-section') as HTMLDivElement;
const manualListInput = document.getElementById('manual-list-input') as HTMLTextAreaElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
const progressSection = document.getElementById('progress-section') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const progressText = document.getElementById('progress-text') as HTMLSpanElement;
const statsText = document.getElementById('stats-text') as HTMLSpanElement;
const exportSection = document.getElementById('export-section') as HTMLDivElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const exportCount = document.getElementById('export-count') as HTMLSpanElement;
const cacheStats = document.getElementById('cache-stats') as HTMLSpanElement;
const cacheClearBtn = document.getElementById('cache-clear') as HTMLAnchorElement;
const statusIndicator = document.getElementById('status-indicator') as HTMLSpanElement;
const errorMessage = document.getElementById('error-message') as HTMLDivElement;
const versionBadge = document.getElementById('version-badge') as HTMLSpanElement;

let adminCompanies: AdminCompany[] = [];
let pageContextCompanyId: string | undefined;

const extensionVersion = chrome.runtime.getManifest().version;
versionBadge.textContent = `v${extensionVersion}`;
consentVersionBadge.textContent = `v${extensionVersion}`;

interface ConsentRecord {
  version: string;
  acceptedAt: string;
}

function renderConsentGate(): void {
  consentHeading.textContent = CONSENT_COPY.heading;
  consentIntro.textContent = CONSENT_COPY.intro;

  for (const section of CONSENT_COPY.sections) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'consent-section';

    const titleEl = document.createElement('h3');
    titleEl.className = 'consent-section-title';
    titleEl.textContent = section.title;
    sectionEl.appendChild(titleEl);

    const listEl = document.createElement('ul');
    listEl.className = 'consent-section-list';
    for (const item of section.items) {
      const li = document.createElement('li');
      li.className = 'consent-section-item';
      li.textContent = item;
      listEl.appendChild(li);
    }
    sectionEl.appendChild(listEl);
    consentSections.appendChild(sectionEl);
  }

  consentPrivacyLink.textContent = CONSENT_COPY.privacyLink;
  consentPrivacyLink.href = chrome.runtime.getURL('PRIVACY_POLICY.md');
  consentAcceptBtn.textContent = CONSENT_COPY.acceptButton;
}

async function checkConsent(): Promise<boolean> {
  const result = await chrome.storage.local.get(CONSENT_STORAGE_KEY);
  const record: ConsentRecord | undefined = result[CONSENT_STORAGE_KEY];
  return record?.version === PRIVACY_POLICY_VERSION;
}

async function acceptConsent(): Promise<void> {
  const record: ConsentRecord = {
    version: PRIVACY_POLICY_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [CONSENT_STORAGE_KEY]: record });
}

consentAcceptBtn.addEventListener('click', async () => {
  consentAcceptBtn.disabled = true;
  await acceptConsent();
  consentGate.classList.add('hidden');
  mainApp.classList.remove('hidden');
  init();
});

async function showConsentOrApp(): Promise<void> {
  const hasConsent = await checkConsent();
  if (hasConsent) {
    mainApp.classList.remove('hidden');
    init();
  } else {
    renderConsentGate();
    consentGate.classList.remove('hidden');
  }
}

async function init() {
  const progressResponse = await sendMessage({ type: 'GET_PROGRESS' });
  if (progressResponse && 'progress' in progressResponse) {
    updateProgressUI(progressResponse.progress);
  }

  const statsResponse = await sendMessage({ type: 'GET_CACHE_STATS' });
  if (statsResponse && 'stats' in statsResponse) {
    updateCacheUI(statsResponse.stats);
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
      if (response?.type === 'PAGE_CONTEXT') {
        handlePageContext(response.context);
      }
    }
  } catch {
    /* content script not loaded on this page */
  }

  loadAdminCompanies();
}

function sendMessage(message: MessageType): Promise<MessageType | { success: boolean; error?: string }> {
  return chrome.runtime.sendMessage(message);
}

async function loadAdminCompanies(): Promise<void> {
  try {
    const response = await sendMessage({ type: 'GET_ADMIN_COMPANIES' });
    if (response && 'companies' in response) {
      adminCompanies = response.companies;
      populateCompanySelect();
    }
  } catch {
    populateCompanySelect();
  }
}

function clearSelectOptions(select: HTMLSelectElement): void {
  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }
}

function populateCompanySelect(): void {
  clearSelectOptions(companySelect);

  if (adminCompanies.length === 0) {
    manualCompanySection.classList.remove('hidden');
    companySelect.classList.add('hidden');
    return;
  }

  for (const company of adminCompanies) {
    const option = document.createElement('option');
    option.value = company.id;
    option.textContent = company.name;
    companySelect.appendChild(option);
  }

  const manualOption = document.createElement('option');
  manualOption.value = MANUAL_ENTRY_VALUE;
  manualOption.textContent = 'Enter manually...';
  companySelect.appendChild(manualOption);

  if (pageContextCompanyId) {
    const match = adminCompanies.find((c) => c.id === pageContextCompanyId);
    if (match) {
      companySelect.value = match.id;
    }
  }

  companySelect.classList.remove('hidden');
}

function getSelectedCompanyId(): string | undefined {
  if (adminCompanies.length === 0 || companySelect.value === MANUAL_ENTRY_VALUE) {
    return companyInput.value.trim() || undefined;
  }
  return companySelect.value || undefined;
}

modeSelect.addEventListener('change', () => {
  const mode = modeSelect.value as ScrapeMode;
  companySection.classList.toggle('hidden', mode !== 'company-followers');
  manualListSection.classList.toggle('hidden', mode !== 'manual-list');
});

companySelect.addEventListener('change', () => {
  manualCompanySection.classList.toggle('hidden', companySelect.value !== MANUAL_ENTRY_VALUE);
});

startBtn.addEventListener('click', () => {
  const mode = modeSelect.value as ScrapeMode;
  const needsCompany = mode === 'company-followers';
  const companySlug = needsCompany ? getSelectedCompanyId() : undefined;

  if (needsCompany && !companySlug) {
    showError(COPY.errors.noCompanySlug);
    return;
  }

  const manualListText = mode === 'manual-list' ? manualListInput.value : undefined;

  if (mode === 'manual-list' && !manualListText?.trim()) {
    showError(COPY.errors.emptyManualList);
    return;
  }

  sendMessage({ type: 'START_SCRAPE', mode, companySlug, manualListText });
  startBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  progressSection.classList.remove('hidden');
  statusIndicator.textContent = mode === 'manual-list'
    ? COPY.statusIndicator.processing
    : COPY.statusIndicator.exporting;
  clearError();
});

stopBtn.addEventListener('click', () => {
  sendMessage({ type: 'STOP_SCRAPE' });
});

exportBtn.addEventListener('click', () => {
  sendMessage({ type: 'EXPORT_DATA' });
});

chrome.runtime.onMessage.addListener((message: MessageType) => {
  if (message.type === 'PROGRESS_UPDATE') {
    updateProgressUI(message.progress);
  }
});

function updateProgressUI(progress: ScrapeProgress) {
  progressSection.classList.remove('hidden');

  if (progress.total) {
    const pct = Math.round((progress.scraped / progress.total) * 100);
    progressBar.style.width = `${pct}%`;
    progressBar.classList.remove('indeterminate');
  } else {
    progressBar.classList.add('indeterminate');
  }

  statsText.textContent = getStatsText(progress.scraped, progress.total, progress.withDomain);

  switch (progress.status) {
    case 'scraping':
      progressText.textContent = getProgressMessage(progress.mode, progress.scraped, progress.total);
      statusIndicator.textContent = progress.mode === 'manual-list'
        ? COPY.statusIndicator.processing
        : COPY.statusIndicator.exporting;
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      break;
    case 'paused':
      progressText.textContent = COPY.status.paused;
      statusIndicator.textContent = COPY.statusIndicator.ready;
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      if (progress.scraped > 0) {
        exportSection.classList.remove('hidden');
        exportCount.textContent = COPY.exportCount(progress.scraped);
      }
      break;
    case 'done':
      progressText.textContent = COPY.status.complete(progress.scraped);
      statusIndicator.textContent = COPY.statusIndicator.complete;
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      if (progress.scraped > 0) {
        exportSection.classList.remove('hidden');
        exportCount.textContent = COPY.exportCount(progress.scraped);
      }
      break;
    case 'error':
      progressText.textContent = COPY.status.idle;
      statusIndicator.textContent = COPY.statusIndicator.error;
      showError(progress.errorMessage ?? COPY.errors.generic('Unknown error'));
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      break;
    case 'idle':
      progressText.textContent = COPY.status.idle;
      statusIndicator.textContent = COPY.statusIndicator.ready;
      progressSection.classList.add('hidden');
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      exportSection.classList.add('hidden');
      break;
  }
}

function updateCacheUI(stats: CacheStats) {
  cacheStats.textContent = COPY.cacheStats(stats.totalCached);
}

function handlePageContext(context: PageContext) {
  if (context.pageType === 'company' && context.companySlug) {
    pageContextCompanyId = context.companySlug;
    companyInput.value = context.companySlug;
    modeSelect.value = 'company-followers';
    companySection.classList.remove('hidden');

    if (adminCompanies.length > 0) {
      populateCompanySelect();
    }
  }
}

function showError(msg: string) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
}

function clearError() {
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}

cacheClearBtn?.addEventListener('click', async (e) => {
  e.preventDefault();
  const consentRecord = (await chrome.storage.local.get(CONSENT_STORAGE_KEY))[CONSENT_STORAGE_KEY];
  await chrome.storage.local.clear();
  if (consentRecord) {
    await chrome.storage.local.set({ [CONSENT_STORAGE_KEY]: consentRecord });
  }
  cacheStats.textContent = COPY.cacheStats(0);
});

showConsentOrApp();
