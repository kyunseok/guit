export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateEvents(rows) {
  if (!Array.isArray(rows)) throw new Error('일정 데이터는 목록이어야 합니다.');
  const ids = new Set();
  return rows.map(row => {
    if (!row || typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) throw new Error('일정 ID를 확인해 주세요.');
    ids.add(row.id);
    if (!['26-2', '27-1'].includes(row.semester) || (row.date !== null && !validDate(row.date)) || typeof row.title !== 'string' || !row.title.trim()) throw new Error('일정의 학기·날짜·제목을 확인해 주세요.');
    if (row.date === null && (row.startTime || row.endTime)) throw new Error('시간을 입력하려면 날짜를 먼저 정해 주세요.');
    for (const field of ['startTime', 'endTime']) {
      if (row[field] && (typeof row[field] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row[field]))) throw new Error('시간은 HH:MM 형식으로 입력해 주세요.');
    }
    if (row.endTime && (!row.startTime || row.endTime <= row.startTime)) throw new Error('종료 시각은 같은 날의 시작 시각보다 늦어야 합니다.');
    for (const field of ['location', 'notes']) if (row[field] != null && typeof row[field] !== 'string') throw new Error('장소와 설명은 텍스트로 입력해 주세요.');
    return { ...row, title: row.title.trim(), startTime: row.startTime || '', endTime: row.endTime || '', location: row.location?.trim() || '', notes: row.notes?.trim() || '' };
  }).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
}

export function monthGrid(month) {
  if (!validDate(month + '-01')) throw new Error('Invalid month');
  const first = new Date(month + '-01T00:00:00Z');
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - first.getUTCDay() + 1;
    return day > 0 && day <= count ? month + '-' + String(day).padStart(2, '0') : null;
  });
}

export function moveDate(date, days) {
  if (!validDate(date)) throw new Error('Invalid date');
  return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}

export function moveMonth(month, amount) {
  if (!validDate(month + '-01')) throw new Error('Invalid month');
  const date = new Date(month + '-01T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export function initialDate(events, today) {
  if (events.some(event => event.date.slice(0, 7) === today.slice(0, 7))) return today;
  return events.find(event => event.date >= today)?.date || events.at(-1)?.date || today;
}
