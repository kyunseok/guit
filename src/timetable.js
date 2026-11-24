const DAY = 86400000;
const OFFSET = 9 * 3600000;
const dateText = time => new Date(time + OFFSET).toISOString().slice(0, 10);
const dayLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' });
const clockLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function timetableRange(date, daily = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  let from = new Date(date + 'T00:00:00+09:00').getTime();
  if (!Number.isFinite(from) || dateText(from) !== date) return null;
  if (!daily) from -= ((new Date(from + OFFSET).getUTCDay() + 6) % 7) * DAY;
  return { from: new Date(from).toISOString(), to: new Date(from + (daily ? 1 : 7) * DAY).toISOString(), days: daily ? 1 : 7 };
}

export function timetableSegments(rows, range) {
  const from = new Date(range.from).getTime();
  return Array.from({ length: range.days }, (_, day) => {
    const midnight = from + day * DAY;
    return rows.filter(row => new Date(row.starts_at).getTime() < midnight + DAY && new Date(row.ends_at).getTime() > midnight).map(row => ({
      row,
      start: (Math.max(new Date(row.starts_at).getTime(), midnight) - midnight) / 60000,
      end: (Math.min(new Date(row.ends_at).getTime(), midnight + DAY) - midnight) / 60000
    }));
  });
}

export function initializeTimetable(onChange, onSelect, isDaily = () => false) {
  const $ = id => document.getElementById(id);
  const date = $('reservation-date'), table = $('reservation-timetable');
  const mobile = window.matchMedia('(max-width: 767px)');
  let previousRange = '', savedScroll = 0;
  date.value = dateText(Date.now());
  const daily = () => mobile.matches || isDaily();
  const range = () => timetableRange(date.value, daily());
  function updatePeriod() {
    const current = range();
    $('reservation-previous').setAttribute('aria-label', daily() ? '이전 날' : '이전 주');
    $('reservation-next').setAttribute('aria-label', daily() ? '다음 날' : '다음 주');
    let label = '';
    if (current) {
      label = dayLabel.format(new Date(current.from));
      if (!daily()) label += ' – ' + dayLabel.format(new Date(new Date(current.to).getTime() - DAY));
    }
    $('reservation-period').textContent = label;
  }
  function change() { updatePeriod(); onChange(); }
  function move(direction) {
    if (!range()) return;
    date.value = dateText(new Date(date.value + 'T00:00:00+09:00').getTime() + direction * (daily() ? 1 : 7) * DAY);
    change();
  }
  $('reservation-previous').addEventListener('click', () => move(-1));
  $('reservation-next').addEventListener('click', () => move(1));
  $('reservation-today').addEventListener('click', () => { date.value = dateText(Date.now()); change(); });
  date.addEventListener('change', change);
  mobile.addEventListener('change', change);
  updatePeriod();
  return {
    range,
    updatePeriod,
    clear() {
      if (table.childElementCount) savedScroll = table.scrollTop;
      table.replaceChildren();
    },
    render(rows) {
      const current = range();
      if (!current) return;
      const scroll = table.childElementCount ? table.scrollTop : savedScroll;
      table.replaceChildren();
      table.style.setProperty('--day-count', current.days);
      const header = document.createElement('div');
      header.className = 'timetable-header';
      const corner = document.createElement('span');
      corner.textContent = '시간';
      header.append(corner);
      const body = document.createElement('div');
      body.className = 'timetable-body';
      const axis = document.createElement('div');
      axis.className = 'timetable-axis';
      for (let hour = 0; hour < 24; hour++) {
        const label = document.createElement('span');
        label.textContent = String(hour).padStart(2, '0') + ':00';
        label.style.top = (hour * 60 / 1440 * 100) + '%';
        axis.append(label);
      }
      body.append(axis);
      const segments = timetableSegments(rows, current);
      segments.forEach((bookings, day) => {
        const timestamp = new Date(current.from).getTime() + day * DAY;
        const heading = document.createElement('span');
        heading.textContent = dayLabel.format(new Date(timestamp));
        if (dateText(timestamp) === dateText(Date.now())) heading.className = 'timetable-today';
        header.append(heading);
        const column = document.createElement('div');
        column.className = 'timetable-day';
        for (const item of bookings) {
          const block = document.createElement('button');
          const { row } = item;
          block.type = 'button';
          block.className = 'timetable-booking ' + (row.purpose === '기타교실' ? 'lesson' : 'practice');
          block.style.top = (item.start / 1440 * 100) + '%';
          block.style.height = ((item.end - item.start) / 1440 * 100) + '%';
          const time = clockLabel.format(new Date(row.starts_at)) + '–' + clockLabel.format(new Date(row.ends_at));
          block.textContent = time + '\n' + row.purpose;
          if (row.is_fixed) {
            block.classList.add('fixed');
            block.textContent = time + '\n고정 · ' + row.user_name;
          }
          const description = dayLabel.format(new Date(row.starts_at)) + ' ' + time + ' ' + row.purpose + ', 사용자 ' + (row.user_name || '미입력') + ', ' + row.people + '명';
          block.setAttribute('aria-label', (row.is_fixed ? '고정 일정, ' : '') + description);
          block.setAttribute('aria-haspopup', 'dialog');
          block.title = description;
          block.addEventListener('click', () => onSelect(row));
          column.append(block);
        }
        body.append(column);
      });
      table.append(header, body);
      const key = current.from + ':' + current.days;
      const starts = rows.map(row => {
        const firstVisible = Math.max(new Date(row.starts_at).getTime(), new Date(current.from).getTime());
        const local = new Date(firstVisible + OFFSET);
        return local.getUTCHours() * 60 + local.getUTCMinutes();
      });
      const firstMinute = starts.length ? Math.min(...starts) : 9 * 60;
      table.scrollTop = key === previousRange ? scroll : Math.max(0, firstMinute / 60 * 56 - 28);
      previousRange = key;
    }
  };
}
