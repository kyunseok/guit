import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { installationPlatform, initializePwa } from '../src/pwa.js';

test('install guidance distinguishes iPhone, desktop-mode iPad and Android', () => {
  assert.equal(installationPlatform({ userAgent: 'iPhone Safari', platform: 'iPhone' }), 'ios');
  assert.equal(installationPlatform({ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  assert.equal(installationPlatform({ userAgent: 'Android Chrome', platform: 'Linux' }), 'android');
  assert.equal(installationPlatform({ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 0 }), 'desktop');
});

test('iPhone installation opens manual steps and standalone launches hide installation', async () => {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url: 'https://example.test/guit/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  let standalone = false;
  window.matchMedia = () => ({ matches: standalone });
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'iPhone Safari', platform: 'iPhone', onLine: true }, configurable: true });
  window.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function() { this.open = false; };
  await initializePwa();
  const button = document.getElementById('install-app');
  assert.match(button.textContent, /아이폰/);
  button.click();
  assert.equal(document.getElementById('install-help').open, true);
  assert.equal(document.querySelector('[data-install-platform="ios"]').hidden, false);
  assert.equal(document.querySelector('[data-install-platform="android"]').hidden, true);
  assert.equal(document.querySelectorAll('[data-install-platform="ios"] li').length, 3);
  standalone = true;
  await initializePwa();
  assert.equal(button.hidden, true);
  window.dispatchEvent(new window.Event('beforeinstallprompt', { cancelable: true }));
  assert.equal(button.hidden, true);
  dom.window.close();
});
