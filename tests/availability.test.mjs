import test from 'node:test';
import assert from 'node:assert/strict';
import { availableSlots } from '../src/availability.js';
import { timetableRange } from '../src/timetable.js';

const time = value => Date.parse('2026-11-25T' + value + ':00+09:00');
const booking = (start, end, is_fixed = false) => ({ starts_at: new Date(time(start)).toISOString(), ends_at: new Date(time(end)).toISOString(), is_fixed });

test('free intervals respect fixed bookings, overlaps and touching endpoints', () => {
  const rows = [booking('10:00', '11:00'), booking('11:00', '12:00', true), booking('10:30', '11:30'), booking('13:15', '14:15')];
  const slots = availableSlots(rows, timetableRange('2026-11-25', true), time('09:00'));
  assert.ok(slots.length);
  for (const slot of slots) {
    const start = Date.parse(slot.starts_at), end = Date.parse(slot.ends_at);
    assert.ok(start > time('09:00'));
    assert.ok(end > start && end - start <= 3600000);
    assert.ok(rows.every(row => end <= Date.parse(row.starts_at) || start >= Date.parse(row.ends_at)));
  }
  assert.ok(slots.some(slot => Date.parse(slot.starts_at) === time('12:00')));
  assert.ok(slots.some(slot => Date.parse(slot.starts_at) === time('14:15')));
});

test('midnight-spanning bookings and past days cannot be selected as free time', () => {
  const range = timetableRange('2026-11-25', true);
  const rows = [{ starts_at: '2026-11-24T23:00:00+09:00', ends_at: '2026-11-25T01:00:00+09:00' }, { starts_at: '2026-11-25T23:00:00+09:00', ends_at: '2026-11-26T01:00:00+09:00' }];
  const slots = availableSlots(rows, range, 0);
  assert.equal(Date.parse(slots[0].starts_at), time('01:00'));
  assert.equal(Date.parse(slots.at(-1).ends_at), time('23:00'));
  assert.deepEqual(availableSlots(rows, range, Date.parse(range.to)), []);
  assert.deepEqual(availableSlots([{ starts_at: range.from, ends_at: range.to }], range, 0), []);
});
