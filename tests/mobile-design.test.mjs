import test from 'node:test';
import assert from 'node:assert/strict';
import { reservationTimes, reservationValues } from '../src/reservation-rules.js';
import { setlistEntries } from '../src/setlist-view.js';

test('one date and two times preserve KST and roll over across month and year boundaries', () => {
  assert.deepEqual(reservationTimes('2026-12-31', '23:30', '01:30'), { start: '2026-12-31T23:30', end: '2027-01-01T01:30', nextDay: true });
  assert.deepEqual(reservationTimes('2028-02-29', '23:30', '00:30'), { start: '2028-02-29T23:30', end: '2028-03-01T00:30', nextDay: true });
  const values = { ...reservationTimes('2026-12-31', '23:30', '01:30'), user_name: '테스트', purpose: '합주연습', people: '3', password: '' };
  assert.equal(reservationValues(values, 0).ends_at, '2027-01-01T01:30:00+09:00');
  assert.throws(() => reservationTimes('2026-02-29', '23:00', '00:00'));
  assert.throws(() => reservationTimes('2026-12-31', '', '00:00'));
});

test('overnight inference never bypasses the two hour or positive duration rules', () => {
  const fields = { user_name: '테스트', purpose: '기타교실', people: '1' };
  assert.throws(() => reservationValues({ ...fields, ...reservationTimes('2026-12-31', '18:00', '17:00') }, 0), /최대 2시간/);
  assert.throws(() => reservationValues({ ...fields, ...reservationTimes('2026-12-31', '18:00', '18:00') }, 0), /늦어야/);
});

test('mobile and desktop entries retain feedback groups even when group-only rows are hidden', () => {
  const result = setlistEntries({ headers: ['구분', '곡명', '가수'], rows: [['1조', '', ''], ['', '동일한 곡', '가수 A'], ['예시', '예시 곡', ''], ['2조', '', ''], ['', '동일한 곡', '가수 B'], ['', '', '']] });
  assert.deepEqual(result.columns.map(column => column.label), ['곡명', '가수']);
  assert.deepEqual(result.entries.map(entry => entry.group), ['1조', '1조', '2조']);
  assert.deepEqual(result.entries.map(entry => entry.example), [false, true, false]);
  assert.equal(result.entries[0].row[1], result.entries[2].row[1]);
});

