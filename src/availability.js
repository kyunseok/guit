const MINUTE = 60000;
const DAY = 86400000;

export function availableSlots(rows, range, now = Date.now()) {
  const from = Date.parse(range.from), to = Date.parse(range.to);
  const occupied = rows.map(row => [Date.parse(row.starts_at), Date.parse(row.ends_at)]).sort((a, b) => a[0] - b[0]);
  const slots = [];
  for (let midnight = from; midnight < to; midnight += DAY) {
    const limit = Math.min(midnight + DAY, to);
    let cursor = Math.max(midnight, Math.ceil((now + MINUTE) / (30 * MINUTE)) * 30 * MINUTE);
    const addGap = end => {
      while (cursor < end) {
        const next = Math.min(end, cursor + 60 * MINUTE);
        if (next - cursor >= 30 * MINUTE) slots.push({ starts_at: new Date(cursor).toISOString(), ends_at: new Date(next).toISOString() });
        cursor = next;
      }
    };
    for (const [start, end] of occupied) {
      if (end <= cursor || start >= limit) continue;
      addGap(Math.min(start, limit));
      cursor = Math.max(cursor, end);
    }
    addGap(limit);
  }
  return slots;
}
