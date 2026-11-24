import test from 'node:test';
import assert from 'node:assert/strict';
import { assignInterviews, csvString } from '../src/recruitment-rules.js';
import { feedbackKey } from '../src/feedback.js';
import { publicFileUrl } from '../src/files.js';
import { createApi, isPublicKey } from '../src/api.js';

test('interview assignments prioritize scarce availability and export safe spreadsheet cells', () => {
  const rows = [
    { name: '=FORMULA()', interview_slots: [{ interview_time: 'A' }, { interview_time: 'B' }] },
    { name: '제한된 일정', interview_slots: [{ interview_time: 'A' }] },
    { name: '중복', interview_slots: [{ interview_time: 'A' }] }
  ];
  const assigned = assignInterviews(rows);
  assert.equal(assigned.find(row => row.이름 === '제한된 일정')['배정된 시간'], 'A');
  assert.equal(assigned.find(row => row.이름 === '=FORMULA()')['배정된 시간'], 'B');
  assert.match(assigned.find(row => row.이름 === '중복')['배정된 시간'], /수동/);
  assert.match(csvString(assigned), /"'=FORMULA\(\)"/);
  assert.equal(rows[0].name, '=FORMULA()');
});

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
