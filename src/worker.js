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
//
// Visiting the root URL (no workshop in the path) shows a simple list of
// links to every configured workshop, so there's always one place to
// find/copy each workshop's link.

const ALLOWED_WORKSHOPS = [
  'richlands',
  'clontarf',
  'beasleys',
  'bundaberg',
  'isadraulics',
  'nordon',
  'swanson'
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/dates')) {
      return handleDatesApi(request, env, url);
    }

    if (url.pathname === '/' || url.pathname === '') {
      return renderWorkshopList();
    }

    // Anything else falls through to the static assets (the site itself).
    return env.ASSETS.fetch(request);
  }
};

function renderWorkshopList() {
  const items = ALLOWED_WORKSHOPS
    .map((slug) => `<li><a href="/${slug}">${labelFor(slug)}</a></li>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Injury Noticeboard - Workshops</title>
<style>
  body{
    margin:0;
    font-family:'Segoe UI', Arial, sans-serif;
    background:#eeeeee;
    display:flex;
    align-items:center;
    justify-content:center;
    min-height:100vh;
    padding:20px;
  }
  .card{
    background:#fff;
    border:2px solid #6d2a5c;
    padding:32px 40px;
    max-width:420px;
    width:100%;
  }
  h1{
    color:#6d2a5c;
    font-size:22px;
    margin:0 0 4px;
  }
  p{
    color:#666;
    margin:0 0 20px;
    font-size:14px;
  }
  ul{
    list-style:none;
    margin:0;
    padding:0;
  }
  li + li{
    border-top:1px solid #e0e0e0;
  }
  a{
    display:block;
    padding:14px 4px;
    color:#333;
    text-decoration:none;
    font-size:16px;
    font-weight:600;
  }
  a:hover{
    color:#6d2a5c;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>Injury Noticeboard</h1>
    <p>Select a workshop to view or update its noticeboard.</p>
    <ul>${items}</ul>
  </div>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

function labelFor(slug) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

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
