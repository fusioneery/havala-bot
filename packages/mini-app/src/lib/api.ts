/**
 * Fetch wrapper that automatically attaches the Telegram WebApp initData
 * header so the server can identify the current user.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const initData = window.Telegram?.WebApp?.initData;
  const headers = new Headers(init?.headers);

  if (initData) {
    headers.set('x-telegram-init-data', initData);
  }

  return fetch(input, { ...init, headers });
}
