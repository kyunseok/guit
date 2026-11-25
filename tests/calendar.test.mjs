import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { validateEvents, validDate, monthGrid, moveDate, moveMonth } from '../src/calendar-rules.js';
import { renderCalendar } from '../src/calendar.js';
import { loadMaterials } from '../src/content.js';
import { slidesPdfUrl } from '../src/materials.js';

const events = validateEvents([
  { id: 'first', semester: '26-2', date: '2026-11-25', title: '정모', startTime: '18:00', endTime: '19:00', location: '동방' },
  { id: 'second', semester: '26-2', date: '2026-11-25', title: '<script>test</script>', location: '' },
  { id: 'third', semester: '27-1', date: '2027-03-01', title: '개강' }
]);

test('calendar dates handle leap years, year boundaries and Korean-local date strings', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(monthGrid('2028-02').filter(Boolean).length, 29);
  assert.equal(monthGrid('2026-11')[0], '2026-11-01');
  assert.equal(monthGrid('2026-11').filter(Boolean).length, 30);
  assert.equal(moveDate('2026-12-31', 1), '2027-01-01');
  assert.equal(moveMonth('2026-12', 1), '2027-01');
  assert.equal(moveMonth('2026-01', -1), '2025-12');
});

test('event data rejects invalid dates, duplicate IDs and impossible times', () => {
  for (const update of [{ date: '2026-02-30' }, { startTime: '25:00' }, { endTime: '17:00' }, { semester: 'unknown' }]) assert.throws(() => validateEvents([{ ...events[0], ...update }]));
  assert.throws(() => validateEvents([events[0], events[0]]));
  assert.deepEqual(validateEvents([]), []);
});

test('dated events replace the image and date selection reveals time and place safely', () => {
  const dom = new JSDOM('<div id="calendar"></div>', { url: 'https://example.test/guit/' });
  globalThis.document = dom.window.document;
  const target = document.getElementById('calendar');
  renderCalendar(target, events, { path: 'assets/calendar.png' }, '26-2', '2026-11-24');
  assert.equal(target.querySelector('img'), null);
  assert.ok(target.querySelector('table'));
  target.querySelector('[data-date="2026-11-25"]').click();
  const detail = target.querySelector('.calendar-details');
  assert.equal(detail.querySelectorAll('article').length, 2);
  assert.match(detail.textContent, /18:00 – 19:00/);
  assert.match(detail.textContent, /동방/);
  assert.match(detail.textContent, /미정/);
  assert.equal(detail.querySelector('script'), null);
  target.querySelector('[data-date="2026-11-26"]').click();
  assert.match(detail.textContent, /등록된 일정이 없습니다/);
  target.querySelector('[aria-label="다음 달"]').click();
  assert.equal(target.querySelector('input').value, '2026-12');
  target.querySelector('[data-date="2026-12-31"]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(target.querySelector('input').value, '2027-01');
  assert.equal(target.querySelector('.calendar-day[aria-pressed="true"]').dataset.date, '2027-01-01');
  dom.window.close();
});

test('empty semester data shows only that semester’s image, or a missing-calendar notice', () => {
  const dom = new JSDOM('<div></div>', { url: 'https://example.test/guit/' });
  globalThis.document = dom.window.document;
  const target = document.querySelector('div');
  renderCalendar(target, [], { path: 'assets/calendar.png' }, '26-2');
  assert.equal(target.querySelector('img').src, 'https://example.test/guit/assets/calendar.png');
  assert.equal(target.querySelector('table'), null);
  renderCalendar(target, events.filter(event => event.semester === '26-2'), null, '27-1');
  assert.equal(target.querySelector('img'), null);
  assert.match(target.textContent, /27-1학기 달력이 아직 등록되지/);
  dom.window.close();
});

test('linked Slides offer direct PDF export without loading an embedded document', async () => {
  const dom = new JSDOM('<div id="materials-list"></div>', { url: 'https://example.test/guit/' });
  globalThis.document = dom.window.document;
  globalThis.fetch = async () => Response.json([{ title: '10주차 정모', url: 'https://docs.google.com/presentation/d/example_id/edit?usp=sharing' }]);
  await loadMaterials();
  const links = [...document.querySelectorAll('a')];
  assert.equal(links[0].textContent, '자료 열기');
  assert.equal(links[1].href, 'https://docs.google.com/presentation/d/example_id/export/pdf');
  assert.equal(document.querySelector('iframe'), null);
  assert.equal(slidesPdfUrl('https://evil.test/presentation/d/example/edit'), null);
  assert.equal(slidesPdfUrl('https://docs.google.com.evil.test/presentation/d/example/edit'), null);
  assert.equal(slidesPdfUrl('javascript:alert(1)'), null);
  dom.window.close();
});

test('calendar and agenda share event data, retaining undated notes and past entries', () => {
  const dom = new JSDOM('<div id="calendar"></div>', { url: 'https://example.test/guit/' });
  globalThis.document = dom.window.document;
  const target = document.getElementById('calendar');
  const data = validateEvents([...events, { id: 'past', semester: '26-2', date: '2026-11-01', title: '지난 행사' }, { id: 'pending', semester: '26-2', date: null, title: '중간고사', notes: '8주차' }]);
  renderCalendar(target, data, null, '26-2', '2026-11-24');
  target.querySelectorAll('.calendar-view-options button')[1].click();
  assert.equal(target.querySelector('.calendar-layout').hidden, true);
  const agenda = target.querySelector('.calendar-agenda');
  assert.equal(agenda.hidden, false);
  assert.match(agenda.textContent, /18:00 – 19:00/);
  assert.match(agenda.querySelector('.agenda-past').textContent, /지난 행사/);
  assert.match(target.querySelector('.calendar-pending').textContent, /중간고사.*8주차/);
  target.querySelector('[aria-label="다음 달"]').click();
  assert.match(agenda.textContent, /이 달에는 등록된 일정이 없습니다/);
  assert.throws(() => validateEvents([{ id: 'invalid', semester: '26-2', date: null, title: '날짜 없음', startTime: '18:00' }]));
  renderCalendar(target, data.filter(event => !event.date), { path: 'assets/calendar.png' }, '26-2');
  assert.ok(target.querySelector('img'));
  assert.match(target.textContent, /중간고사/);
  dom.window.close();
});
