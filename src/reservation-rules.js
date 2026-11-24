export const HOUR = 60 * 60 * 1000;
const KST = 9 * HOUR;

export function koreaInput(value = Date.now()) {
  return new Date(new Date(value).getTime() + KST).toISOString().slice(0, 16);
}

export function koreaTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const time = new Date(value + ':00+09:00').getTime();
  return Number.isFinite(time) && koreaInput(time) === value ? time : NaN;
}

export function koreaMonthRange(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const from = koreaTime(value + '-01T00:00');
  if (!Number.isFinite(from)) return null;
  const next = new Date(from + KST);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from: new Date(from).toISOString(), to: new Date(next.getTime() - KST).toISOString() };
}

export function reservationTimes(date, start, end) {
  const begins = date + 'T' + start;
  const finishes = date + 'T' + end;
  const startTime = koreaTime(begins), endTime = koreaTime(finishes);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) throw new Error('날짜와 시작·종료 시각을 입력해 주세요.');
  const nextDay = endTime < startTime;
  return { start: begins, end: koreaInput(endTime + (nextDay ? 24 * HOUR : 0)), nextDay };
}

export function reservationValues(values, now = Date.now()) {
  const start = koreaTime(values.start), end = koreaTime(values.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('시작 일시와 종료 일시를 입력해 주세요.');
  if (start <= now) throw new Error('예약 시작은 현재 시각 이후로 선택해 주세요.');
  if (end <= start) throw new Error('종료 일시는 시작 일시보다 늦어야 합니다.');
  if (end - start > 2 * HOUR) throw new Error('동방은 한 번에 최대 2시간까지 예약할 수 있습니다.');
  const user_name = (values.user_name || '').trim();
  if (!user_name || user_name.length > 100) throw new Error('사용자를 1~100자로 입력해 주세요.');
  const purpose = values.purpose, people = Number(values.people);
  if (!['기타교실', '합주연습'].includes(purpose)) throw new Error('예약 목적은 기타교실 또는 합주연습 중에서 선택해 주세요.');
  if (!Number.isInteger(people) || people < 1 || people > 2147483647) throw new Error('사용 인원을 1명 이상의 정수로 입력해 주세요.');
  const password = values.password || '';
  if (password.length > 128) throw new Error('비밀번호는 128자 이하로 입력해 주세요.');
  return { password, starts_at: koreaInput(start) + ':00+09:00', ends_at: koreaInput(end) + ':00+09:00', user_name, purpose, people };
}

export function reservationsOverlap(a, b) {
  return new Date(a.starts_at) < new Date(b.ends_at) && new Date(b.starts_at) < new Date(a.ends_at);
}
