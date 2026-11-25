import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const tick = () => new Promise(resolve => setTimeout(resolve, 15));

test('the app routes club features, shows calendar data and limits installation to the introduction', async () => {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url: 'https://example.test/guit/#schedule', pretendToBeVisual: true });
  const content = JSON.parse(await readFile(new URL('../data/content.json', import.meta.url), 'utf8'));
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.FormData = dom.window.FormData;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = callback => callback();
  globalThis.ResizeObserver = class { observe() {} };
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() } });
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function() { this.open = false; };
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    calls.push(url.href);
    let data;
    if (url.pathname.endsWith('/content.json')) data = content;
    else if (url.pathname.endsWith('/config.json')) data = { supabaseUrl: 'https://database.test', supabasePublishableKey: 'sb_publishable_mock_test_only' };
    else if (url.pathname.endsWith('/calendar.json')) data = { '26-2': { path: 'assets/calendar.png' } };
    else if (url.pathname.endsWith('/events.json')) data = [{ id: 'one', semester: '26-2', date: '2026-11-25', title: '모임', startTime: '18:00', location: '동방' }];
    else if (url.pathname.endsWith('/materials.json')) data = [{ title: '정모 자료', path: 'materials/test.pdf', name: 'test.pdf', size: 2000 }];
    else if (url.hostname === 'docs.google.com') return new Response('안내\n구분,곡명,가수\n1조,테스트곡,테스트가수');
    else throw new Error('Unexpected fetch: ' + url);
    return Response.json(data);
  };
  await import('../app.js');
  await tick();
  const $ = id => document.getElementById(id);
  assert.equal($('introduction').textContent, content.introduction);
  assert.equal($('schedule').hidden, false);
  assert.equal($('calendar-container-26-2').querySelector('img'), null);
  assert.ok($('calendar-container-26-2').querySelector('table'));
  assert.ok($('about').contains($('install-app')));
  assert.equal($('about').hidden, true);
  assert.equal($('materials-list').querySelector('iframe'), null);
  $('materials-list').querySelector('button').click();
  assert.match($('materials-list').querySelector('iframe').src, /materials\/test\.pdf/);
  for (const view of ['about', 'schedule/27-1', 'guitar-class/26-2', 'room-reservation/book', 'performances']) {
    location.hash = view;
    await tick();
    assert.equal($(view.split('/')[0]).hidden, false);
  }
  assert.equal($('recruitment'), null);
  assert.equal(document.querySelector('[href="#recruitment"]'), null);
  location.hash = 'recruitment';
  await tick();
  assert.equal($('about').hidden, false);
  assert.equal(window.localStorage.length, 0);
  $('install-app').click();
  assert.equal($('install-help').open, true);
  dom.window.close();
});
