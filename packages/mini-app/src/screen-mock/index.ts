import {
  MOCK_CONTACTS,
  MOCK_GROUPS,
  MOCK_MATCHES,
  MOCK_OFFER_TEXT,
  MOCK_OFFERS,
  MOCK_SEARCH_RESULTS,
} from './mock-data';

export const isScreenMock =
  new URLSearchParams(window.location.search).get('screenMock') === '1';

function mockResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resolvePathname(input: RequestInfo | URL): string {
  const str =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;
  try {
    return new URL(str, window.location.origin).pathname;
  } catch {
    return str;
  }
}

export function installScreenMocks(): void {
  if (!isScreenMock) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const pathname = resolvePathname(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    // GET /api/offers
    if (method === 'GET' && pathname === '/api/offers') {
      return Promise.resolve(mockResponse(MOCK_OFFERS));
    }

    // DELETE /api/offers/:id
    if (method === 'DELETE' && /^\/api\/offers\/\d+$/.test(pathname)) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    // GET /api/feed
    if (method === 'GET' && pathname === '/api/feed') {
      return Promise.resolve(mockResponse(MOCK_OFFERS));
    }

    // GET /api/contacts
    if (method === 'GET' && pathname === '/api/contacts') {
      return Promise.resolve(mockResponse(MOCK_CONTACTS));
    }

    // DELETE /api/contacts/:id
    if (method === 'DELETE' && /^\/api\/contacts\/\d+$/.test(pathname)) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    // POST /api/contacts
    if (method === 'POST' && pathname === '/api/contacts') {
      return Promise.resolve(new Response(null, { status: 201 }));
    }

    // GET /api/contacts/search
    if (method === 'GET' && pathname === '/api/contacts/search') {
      return Promise.resolve(mockResponse(MOCK_SEARCH_RESULTS));
    }

    // GET /api/groups
    if (method === 'GET' && pathname === '/api/groups') {
      return Promise.resolve(mockResponse(MOCK_GROUPS));
    }

    // POST /api/offers/search
    if (method === 'POST' && pathname === '/api/offers/search') {
      const offerId = MOCK_OFFERS[0].id;
      const responseBody = {
        userOffer: { id: offerId, status: 'active' },
        matches: MOCK_MATCHES,
        offerText: MOCK_OFFER_TEXT,
      };
      sessionStorage.setItem(
        `matches:${offerId}`,
        JSON.stringify({ matches: MOCK_MATCHES, offerText: MOCK_OFFER_TEXT }),
      );
      return Promise.resolve(mockResponse(responseBody));
    }

    // Everything else (rates, avatar images, etc.) passes through
    return originalFetch(input, init);
  };

  // Pre-seed sessionStorage so /matches/:id links work from HomePage
  for (const offer of MOCK_OFFERS) {
    sessionStorage.setItem(
      `matches:${offer.id}`,
      JSON.stringify({ matches: MOCK_MATCHES, offerText: MOCK_OFFER_TEXT }),
    );
  }

  console.info(
    '%c[screen-mock] mock fetch installed — screenshot-ready data active',
    'color: #6ee7b7; font-weight: bold',
  );
}
