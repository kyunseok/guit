import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const scope = 'https://example.test/guit/';
const files = ['index.html', 'app.js?v=test', 'config.json', 'data/content.json'];
function worker() {
  const events = new Map(), stored = new Map(), deleted = [], requested = [];
  let skipped = 0, claimed = 0;
  const cache = {
    async addAll(requests) { for (const request of requests) { requested.push(request); stored.set(request.url, new Response('saved ' + request.url)); } },
    async match(url) { return stored.get(url); }
  };
  const self = {
    registration: { scope }, clients: { async claim() { claimed++; } },
    async skipWaiting() { skipped++; }, addEventListener: (name, callback) => events.set(name, callback)
  };
  const caches = { async open() { return cache; }, async keys() { return ['other-site', 'guitarhana:' + scope + 'old', 'guitarhana:' + scope + 'test']; }, async delete(key) { deleted.push(key); } };
  vm.runInNewContext(source.replace('__BUILD_VERSION__', 'test').replace('__SHELL_FILES__', JSON.stringify(files)), { self, caches, URL, Request, fetch: async () => { throw new Error('OFFLINE'); } });
  return { events, stored, deleted, requested, skipped: () => skipped, claimed: () => claimed };
}
async function lifetime(instance, name, data = {}) {
  let work;
  instance.events.get(name)({ ...data, waitUntil(promise) { work = promise; } });
  await work;
}
function fetchResult(instance, path, options = {}) {
  let result;
  const request = { url: new URL(path, scope).href, method: 'GET', mode: 'cors', headers: new Headers(), ...options };
  instance.events.get('fetch')({ request, respondWith(value) { result = value; } });
  return result;
}

test('the offline shell works at a repository subpath and an update waits for explicit activation', async () => {
  const instance = worker();
  await lifetime(instance, 'install');
  assert.equal(instance.skipped(), 0);
  assert.equal(instance.requested.length, files.length);
  assert.ok(instance.requested.every(request => request.url.startsWith(scope) && request.cache === 'reload'));
  const response = await fetchResult(instance, './#room-reservation', { mode: 'navigate' });
  assert.equal(await response.text(), 'saved ' + scope + 'index.html');
  await lifetime(instance, 'message', { data: { type: 'IGNORE' } });
  assert.equal(instance.skipped(), 0);
  await lifetime(instance, 'message', { data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(instance.skipped(), 1);
  await lifetime(instance, 'activate');
  assert.deepEqual(instance.deleted, ['guitarhana:' + scope + 'old']);
  assert.equal(instance.claimed(), 1);
});

test('database responses, credentials, Sheets, PDFs and out-of-scope pages never enter the cache', async () => {
  const instance = worker();
  await lifetime(instance, 'install');
  for (const [url, options] of [
    ['https://database.test/rest/v1/room_reservations', {}],
    ['https://database.test/rest/v1/rpc/guitarhana_cancel_room_v1', { method: 'POST' }],
    ['https://docs.google.com/spreadsheets/d/test/edit', {}],
    ['rpc/private', {}], ['materials/file.pdf', {}],
    ['materials/file.pdf', { mode: 'navigate' }],
    ['/another-site/', { mode: 'navigate' }],
    ['config.json', { method: 'POST' }],
    ['app.js?v=test', { headers: new Headers({ range: 'bytes=0-100' }) }],
    ['config.json?password=private', {}]
  ]) assert.equal(fetchResult(instance, url, options), undefined, url);
  assert.equal(instance.stored.size, files.length);
});
