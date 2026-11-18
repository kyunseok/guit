import test from 'node:test';
import assert from 'node:assert/strict';
import { timetableRange, timetableSegments } from '../timetable.js';

test('weekly and daily views use Korean dates across year boundaries', () => {
  assert.deepEqual(timetableRange('2027-01-01'), { from: '2026-12-27T15:00:00.000Z', to: '2027-01-03T15:00:00.000Z', days: 7 });
  assert.deepEqual(timetableRange('2027-01-01', true), { from: '2026-12-31T15:00:00.000Z', to: '2027-01-01T15:00:00.000Z', days: 1 });
  for (const date of ['', '2026-02-30', '2026-13-01']) assert.equal(timetableRange(date), null);
});

test('midnight bookings split into correct days without duplicating touching endpoints', () => {
  const row = { id: 'overnight', starts_at: '2026-11-18T23:00:00+09:00', ends_at: '2026-11-19T01:00:00+09:00' };
  const parts = timetableSegments([row], timetableRange('2026-11-18'));
  assert.equal(parts[2][0].start, 1380);
  assert.equal(parts[2][0].end, 1440);
  assert.equal(parts[3][0].start, 0);
  assert.equal(parts[3][0].end, 60);
  assert.deepEqual(timetableSegments([row], timetableRange('2026-11-20', true)), [[]]);
  const midnight = { ...row, ends_at: '2026-11-19T00:00:00+09:00' };
  assert.deepEqual(timetableSegments([midnight], timetableRange('2026-11-19', true)), [[]]);
});
