import { CSRF_TOKEN_PREFIX } from './constants.js';

export async function getCSRFToken(): Promise<string> {
  const cookie = await chrome.cookies.get({
    url: 'https://www.linkedin.com',
    name: 'JSESSIONID',
  });

  if (!cookie?.value) {
    throw new Error('JSESSIONID cookie not found - user may not be logged in to LinkedIn');
  }

  let value = cookie.value;
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  if (value.startsWith(CSRF_TOKEN_PREFIX)) {
    return value;
  }

  return `${CSRF_TOKEN_PREFIX}${value}`;
}
