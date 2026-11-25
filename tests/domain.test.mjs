import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackKey } from '../src/feedback.js';
import { publicFileUrl } from '../src/files.js';
import { createApi, isPublicKey } from '../src/api.js';

test('feedback identity remains stable but isolates performances, rehearsals and groups', async () => {
  const url = 'https://docs.google.com/spreadsheets/d/sample/edit';
  const original = await feedbackKey(url, ' 곡  제목 ', '1조');
  assert.equal(original, await feedbackKey(url + '?gid=0', '곡 제목', '1조'));
  assert.notEqual(original, await feedbackKey(url + '?gid=42', '곡 제목', '1조'));
  assert.notEqual(original, await feedbackKey(url, '곡 제목', '2조'));
});

test('public asset paths stay inside the GitHub Pages subdirectory and privileged keys are rejected', () => {
  const base = 'https://example.test/guit/';
  assert.equal(publicFileUrl('materials/file.pdf', base), base + 'materials/file.pdf');
  for (const path of ['../private.json', 'https://other.test/file.pdf', '//other.test/file.pdf']) assert.throws(() => publicFileUrl(path, base));
  assert.equal(isPublicKey('sb_secret_private'), false);
  assert.throws(() => createApi({ supabaseUrl: 'https://database.test', supabasePublishableKey: 'sb_secret_private' }));
});

test('offline writes fail without dispatching or queuing a request', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  let calls = 0;
  try {
    const api = createApi({ supabaseUrl: 'https://database.test', supabasePublishableKey: 'sb_publishable_mock_test_only' }, () => { calls++; });
    await assert.rejects(api.reservationCancel('id', 'password'), /OFFLINE/);
    assert.equal(calls, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  }
});
