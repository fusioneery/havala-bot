import {
  STRESS_CONTACTS,
  STRESS_GROUPS,
  STRESS_MATCHES,
  STRESS_OFFER_TEXT,
  STRESS_OFFERS,
  STRESS_SEARCH_RESULTS,
} from './mock-data';

export const isStressTest =
  new URLSearchParams(window.location.search).get('stress') === '1';

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

export function installStressMocks(): void {
  if (!isStressTest) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const pathname = resolvePathname(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    // GET /api/offers
    if (method === 'GET' && pathname === '/api/offers') {
      return Promise.resolve(mockResponse(STRESS_OFFERS));
    }

    // DELETE /api/offers/:id — still allow, but return success without hitting server
    if (method === 'DELETE' && /^\/api\/offers\/\d+$/.test(pathname)) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    // GET /api/feed
    if (method === 'GET' && pathname === '/api/feed') {
      return Promise.resolve(mockResponse(STRESS_OFFERS));
    }

    // GET /api/contacts
    if (method === 'GET' && pathname === '/api/contacts') {
      return Promise.resolve(mockResponse(STRESS_CONTACTS));
    }

    // DELETE /api/contacts/:id — return success
    if (method === 'DELETE' && /^\/api\/contacts\/\d+$/.test(pathname)) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    // POST /api/contacts — return success
    if (method === 'POST' && pathname === '/api/contacts') {
      return Promise.resolve(new Response(null, { status: 201 }));
    }

    // GET /api/contacts/search
    if (method === 'GET' && pathname === '/api/contacts/search') {
      return Promise.resolve(mockResponse(STRESS_SEARCH_RESULTS));
    }

    // GET /api/groups
    if (method === 'GET' && pathname === '/api/groups') {
      return Promise.resolve(mockResponse(STRESS_GROUPS));
    }

    // POST /api/offers/search — return stress matches and navigate to a stress offer
    if (method === 'POST' && pathname === '/api/offers/search') {
      const stressOfferId = STRESS_OFFERS[0].id;
      const responseBody = {
        userOffer: { id: stressOfferId, status: 'active' },
        matches: STRESS_MATCHES,
        offerText: STRESS_OFFER_TEXT,
      };
      sessionStorage.setItem(
        `matches:${stressOfferId}`,
        JSON.stringify({ matches: STRESS_MATCHES, offerText: STRESS_OFFER_TEXT }),
      );
      return Promise.resolve(mockResponse(responseBody));
    }

    // Everything else (rates, invite-link, etc.) passes through
    return originalFetch(input, init);
  };

  // Pre-seed sessionStorage so /matches/:id links work directly from HomePage
  for (const offer of STRESS_OFFERS) {
    sessionStorage.setItem(
      `matches:${offer.id}`,
      JSON.stringify({ matches: STRESS_MATCHES, offerText: STRESS_OFFER_TEXT }),
    );
  }

  console.info(
    '%c[stress-test] mock fetch installed — worst-case UI data active',
    'color: #c8f135; font-weight: bold',
  );
}
