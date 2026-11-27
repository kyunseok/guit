export function parseSheetCatalog(html) {
  const sheets = [];
  const seen = new Set();
  const pattern = /items\.push\(\{name:\s*("(?:[^"\\]|\\.)*"),\s*pageUrl:\s*"(?:[^"\\]|\\.)*",\s*gid:\s*"(\d+)"/g;
  for (const match of html.matchAll(pattern)) {
    const title = JSON.parse(match[1].replace(/\\x([\da-f]{2})/gi, '\\u00$1'));
    const gid = match[2];
    if (!seen.has(gid) && typeof title === 'string' && title.trim()) {
      seen.add(gid);
      sheets.push({ gid, title });
    }
  }
  if (!sheets.length) throw new Error('SHEETS_UNAVAILABLE');
  return sheets;
}

export function createCatalogHandler({ documents, keys, transport = fetch, now = Date.now }) {
  const cache = new Map();
  const inflight = new Map();
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Cache-Control': 'no-store' };
  const reply = (body, status = 200) => Response.json(body, { status, headers });
  async function load(id) {
    const response = await transport('https://docs.google.com/spreadsheets/d/' + id + '/htmlview', { signal: AbortSignal.timeout(12000), redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('SHEETS_UNAVAILABLE');
    const html = await response.text();
    if (html.length > 2000000) throw new Error('SHEETS_UNAVAILABLE');
    const sheets = parseSheetCatalog(html);
    cache.set(id, { sheets, until: now() + 60000 });
    return sheets;
  }
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const key = request.headers.get('apikey');
    if (!key || !keys.includes(key)) return reply({ error: 'UNAUTHORIZED' }, 401);
    const id = new URL(request.url).searchParams.get('document');
    if (!documents.includes(id)) return reply({ error: 'UNKNOWN_DOCUMENT' }, 400);
    try {
      const saved = cache.get(id);
      if (saved && saved.until > now()) return reply({ sheets: saved.sheets });
      if (!inflight.has(id)) inflight.set(id, load(id).finally(() => inflight.delete(id)));
      return reply({ sheets: await inflight.get(id) });
    } catch { return reply({ error: 'SHEETS_UNAVAILABLE' }, 502); }
  };
}
