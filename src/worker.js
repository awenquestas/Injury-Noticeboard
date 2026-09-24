// Injury Noticeboard - Cloudflare Worker
//
// This Worker serves the static site (from the /public folder, via the
// ASSETS binding configured in wrangler.jsonc) and handles the small
// /api/dates endpoint that reads/writes each workshop's injury dates
// in the INJURY_DATES KV namespace.
//
// Each workshop's dates are stored under their own key (e.g. "richlands",
// "clontarf"), so one workshop's Settings modal can only ever read or
// write its own data.

const ALLOWED_WORKSHOPS = ['richlands', 'clontarf'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/dates')) {
      return handleDatesApi(request, env, url);
    }

    // Anything else falls through to the static assets (the site itself).
    // With run_worker_first configured for /api/*, this branch is mostly
    // a safety net.
    return env.ASSETS.fetch(request);
  }
};

async function handleDatesApi(request, env, url) {
  const workshop = (url.searchParams.get('workshop') || '').trim().toLowerCase();

  if (!ALLOWED_WORKSHOPS.includes(workshop)) {
    return jsonResponse({ error: 'Unknown workshop' }, 400);
  }

  if (request.method === 'GET') {
    const stored = await env.INJURY_DATES.get(workshop, 'json');
    return jsonResponse(stored || null);
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    // Only store the three fields we expect, as plain ISO date strings.
    const dates = {
      lti: String(body.lti || ''),
      mti: String(body.mti || ''),
      fai: String(body.fai || '')
    };

    await env.INJURY_DATES.put(workshop, JSON.stringify(dates));
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
