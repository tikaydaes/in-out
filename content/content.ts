import { VOYAGER_BASE } from '../lib/constants.js';
import type { PageContext, MessageType } from '../lib/types.js';

function detectPageContext(): PageContext {
  const url = window.location.href;

  const companyMatch = url.match(/linkedin\.com\/company\/([^/?#]+)/);
  if (companyMatch) {
    return { pageType: 'company', companySlug: companyMatch[1] };
  }

  if (/linkedin\.com\/in\/[^/?#]+/.test(url)) {
    return { pageType: 'profile' };
  }

  if (/linkedin\.com\/mynetwork/.test(url)) {
    return { pageType: 'connections' };
  }

  return { pageType: 'other' };
}

interface ProxyFetchMessage {
  type: 'VOYAGER_FETCH';
  url: string;
  options: { method: string; headers: Record<string, string>; credentials?: RequestCredentials };
}

interface ProxyFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string | null>;
  body: string;
  error?: string;
}

function isVoyagerFetch(message: unknown): message is ProxyFetchMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === 'VOYAGER_FETCH'
  );
}

chrome.runtime.onMessage.addListener(
  (message: MessageType | ProxyFetchMessage, _sender, sendResponse): boolean => {
    if (isVoyagerFetch(message)) {
      if (!message.url.startsWith(VOYAGER_BASE)) {
        sendResponse({ ok: false, status: 403, statusText: 'Forbidden', headers: {}, body: '', error: 'URL outside Voyager API scope' } satisfies ProxyFetchResponse);
        return true;
      }

      (async () => {
        try {
          const response = await fetch(message.url, {
            method: message.options.method,
            headers: message.options.headers,
            credentials: 'include',
          });

          const body = await response.text();
          sendResponse({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: { 'retry-after': response.headers.get('retry-after') },
            body,
          } satisfies ProxyFetchResponse);
        } catch (error) {
          sendResponse({
            ok: false,
            status: 0,
            statusText: error instanceof Error ? error.message : 'Network error',
            headers: {},
            body: '',
            error: error instanceof Error ? error.message : 'Network error',
          } satisfies ProxyFetchResponse);
        }
      })();

      return true;
    }

    if ((message as MessageType).type === 'GET_PAGE_CONTEXT') {
      const context = detectPageContext();
      const response: MessageType = { type: 'PAGE_CONTEXT', context };
      sendResponse(response);
    }

    return false;
  },
);

let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    const context = detectPageContext();
    const message: MessageType = { type: 'PAGE_CONTEXT', context };
    try {
      chrome.runtime.sendMessage(message);
    } catch {
      observer.disconnect();
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
