import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSheetCatalog, createCatalogHandler } from '../supabase/functions/sheet-catalog/catalog.js';
import { fetchSetlist } from '../src/setlists.js';

const html = 'items.push({name: "셋리", pageUrl: "https:\\/\\/docs.google.com/example", gid: "0",initialSheet: true});items.push({name: "1차\\x20리허설", pageUrl: "example", gid: "42",initialSheet: false});';
test('public sheet metadata is decoded as data, deduplicated and never executed', () => {
  assert.deepEqual(parseSheetCatalog(html + html), [{ gid: '0', title: '셋리' }, { gid: '42', title: '1차 리허설' }]);
  assert.throws(() => parseSheetCatalog('<html>Sign in</html>'));
});

test('catalog endpoint checks keys and document allowlist before fetching, caches briefly and handles upstream failures', async () => {
  let count = 0, now = 0, fail = false;
  const handler = createCatalogHandler({ documents: ['allowed'], keys: ['public-test'], now: () => now, transport: async url => {
    count++;
    assert.equal(url, 'https://docs.google.com/spreadsheets/d/allowed/htmlview');
    return new Response(fail ? 'unavailable' : html, { status: fail ? 503 : 200, headers: { 'content-type': 'text/html' } });
  } });
  const req = (document = 'allowed', key = 'public-test') => new Request('https://example.test/?document=' + document, { headers: { apikey: key } });
  assert.equal((await handler(req('allowed', 'wrong'))).status, 401);
  assert.equal((await handler(req('https://private.test'))).status, 400);
  assert.equal(count, 0);
  const first = await handler(req());
  assert.equal((await first.json()).sheets.length, 2);
  await handler(req()); assert.equal(count, 1);
  now = 60001; fail = true;
  assert.equal((await handler(req())).status, 502);
  assert.equal(count, 2);
});

test('setlist import finds shifted song columns and keeps non-song sheets as plain tables', async () => {
  const csv = '안내\n구분,시간,가수 - 곡명,기타\n,21:00,테스트곡,연주자';
  const transport = async () => new Response(csv, { headers: { 'content-type': 'text/csv' } });
  const result = await fetchSetlist('https://docs.google.com/spreadsheets/d/test/edit?gid=42', undefined, transport);
  assert.equal(result.songColumn, 2);
  assert.equal(result.rows[0][2], '테스트곡');
  const plain = await fetchSetlist('https://docs.google.com/spreadsheets/d/test/edit', undefined, async () => new Response('명단,인원\n가나다,3', { headers: { 'content-type': 'text/csv' } }));
  assert.equal(plain.songColumn, -1);
  assert.equal(plain.rows.length, 2);
});
