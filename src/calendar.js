import { $, element } from './ui.js';
import { jsonFile, publicFileUrl } from './files.js';
import { koreaInput } from './reservation-rules.js';
import { validateEvents, monthGrid, moveDate, moveMonth, initialDate, validDate } from './calendar-rules.js';

const dayLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

function calendarImage(target, image, semester, warning = '') {
  target.replaceChildren();
  if (warning) target.append(element('p', warning, 'notice warning'));
  if (!image?.path) { target.append(element('p', semester + '학기 달력이 아직 등록되지 않았습니다.', 'notice')); return; }
  const figure = element('figure', undefined, 'calendar-figure');
  const img = element('img');
  img.alt = semester + '학기 일정';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => figure.replaceChildren(element('p', '달력 이미지를 불러올 수 없습니다.', 'notice error')));
  try { img.src = publicFileUrl(image.path, document.baseURI); }
  catch { target.append(element('p', '달력 이미지 경로를 확인해 주세요.', 'notice error')); return; }
  figure.append(img);
  target.append(figure);
}

function eventCard(event) {
  const card = element('article', undefined, 'calendar-event');
  card.append(element('h4', event.title));
  const info = element('dl');
  const time = event.startTime ? event.startTime + (event.endTime ? ' – ' + event.endTime : '') : '미정';
  info.append(element('dt', '시간'), element('dd', time + (event.startTime ? ' (한국 시간)' : '')), element('dt', '장소'), element('dd', event.location || '미정'));
  card.append(info);
  if (event.notes) card.append(element('p', event.notes, 'calendar-event-notes'));
  return card;
}

export function renderCalendar(target, events, image, semester, today = koreaInput().slice(0, 10)) {
  const semesterEvents = events.filter(event => event.semester === semester);
  const rows = semesterEvents.filter(event => event.date);
  const pending = element('details', undefined, 'calendar-pending');
  const undated = semesterEvents.filter(event => !event.date);
  pending.hidden = !undated.length;
  pending.append(element('summary', '날짜 미정 일정 · ' + undated.length + '개'));
  for (const event of undated) pending.append(eventCard(event));
  if (!rows.length) { calendarImage(target, image, semester); target.append(pending); return; }
  let selected = initialDate(rows, today);
  let month = selected.slice(0, 7);
  const byDate = new Map();
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  }
  const toolbar = element('div', undefined, 'calendar-toolbar');
  const previous = element('button', '이전'), next = element('button', '다음'), current = element('button', '이번 달');
  for (const button of [previous, next, current]) button.type = 'button';
  previous.setAttribute('aria-label', '이전 달');
  next.setAttribute('aria-label', '다음 달');
  const monthLabel = element('label', '조회 월', 'calendar-month-label');
  const input = element('input');
  input.type = 'month';
  input.required = true;
  input.setAttribute('aria-label', semester + '학기 조회 월');
  monthLabel.append(input);
  toolbar.append(previous, monthLabel, next, current);
  const summary = element('p', undefined, 'muted calendar-summary');
  const table = element('table', undefined, 'event-calendar');
  const caption = element('caption');
  const head = element('thead'), weekdays = element('tr'), body = element('tbody');
  for (const day of ['일', '월', '화', '수', '목', '금', '토']) {
    const cell = element('th', day);
    cell.scope = 'col';
    weekdays.append(cell);
  }
  head.append(weekdays);
  table.append(caption, head, body);
  const detail = element('section', undefined, 'calendar-details');
  detail.id = 'calendar-details-' + semester;
  detail.setAttribute('aria-live', 'polite');
  detail.setAttribute('aria-label', '선택한 날짜의 일정');
  const layout = element('div', undefined, 'calendar-layout');
  const grid = element('div', undefined, 'calendar-grid');
  grid.append(table);
  layout.append(grid, detail);
  const agenda = element('section', undefined, 'calendar-agenda');
  agenda.hidden = true;
  agenda.setAttribute('aria-label', '월별 일정 목록');
  const options = element('div', undefined, 'calendar-view-options');
  options.setAttribute('aria-label', '일정 보기 방식');
  const views = ['달력 보기', '목록 보기'].map((label, index) => {
    const button = element('button', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === 0));
    button.addEventListener('click', () => {
      layout.hidden = index === 1;
      agenda.hidden = index === 0;
      views.forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)));
    });
    options.append(button);
    return button;
  });
  target.replaceChildren(options, toolbar, summary, layout, agenda, pending);

  function showDetails() {
    detail.replaceChildren(element('h3', dayLabel.format(new Date(selected + 'T00:00:00+09:00'))));
    const selectedEvents = byDate.get(selected) || [];
    if (!selectedEvents.length) { detail.append(element('p', '등록된 일정이 없습니다.', 'muted')); return; }
    for (const event of selectedEvents) detail.append(eventCard(event));
  }

  function renderAgenda() {
    agenda.replaceChildren();
    const dates = [...byDate.keys()].filter(date => date.startsWith(month)).sort();
    if (!dates.length) { agenda.append(element('p', '이 달에는 등록된 일정이 없습니다.', 'notice')); return; }
    let previous = null;
    for (const date of dates) {
      const day = element('section', undefined, 'agenda-day');
      day.append(element('h3', dayLabel.format(new Date(date + 'T00:00:00+09:00'))));
      for (const event of byDate.get(date)) day.append(eventCard(event));
      if (date < today && month === today.slice(0, 7)) {
        if (!previous) {
          previous = element('details', undefined, 'agenda-past');
          previous.append(element('summary', '지난 일정 보기'));
        }
        previous.append(day);
      } else agenda.append(day);
    }
    if (previous) agenda.append(previous);
  }

  function select(date, focus = false) {
    selected = date;
    if (month !== date.slice(0, 7)) { month = date.slice(0, 7); renderMonth(); }
    for (const button of body.querySelectorAll('button')) {
      const active = button.dataset.date === selected;
      button.setAttribute('aria-pressed', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus({ preventScroll: true });
    }
    showDetails();
  }

  function dateButton(date) {
    const entries = byDate.get(date) || [];
    const button = element('button', undefined, 'calendar-day');
    button.type = 'button';
    button.dataset.date = date;
    button.setAttribute('aria-label', dayLabel.format(new Date(date + 'T00:00:00+09:00')) + ', 일정 ' + entries.length + '개');
    button.setAttribute('aria-controls', detail.id);
    button.setAttribute('aria-pressed', String(date === selected));
    button.tabIndex = date === selected ? 0 : -1;
    if (date === today) button.setAttribute('aria-current', 'date');
    button.append(element('span', String(Number(date.slice(8))), 'calendar-day-number'));
    if (entries.length) {
      const titles = element('span', undefined, 'calendar-day-events');
      for (const event of entries.slice(0, 2)) titles.append(element('span', event.title));
      if (entries.length > 2) titles.append(element('span', '+' + (entries.length - 2)));
      button.append(titles, element('span', entries.length + '개', 'calendar-day-count'));
    }
    button.addEventListener('click', () => select(date));
    button.addEventListener('keydown', event => {
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (!(event.key in offsets)) return;
      event.preventDefault();
      select(moveDate(date, offsets[event.key]), true);
    });
    return button;
  }

  function renderMonth() {
    input.value = month;
    caption.textContent = month.slice(0, 4) + '년 ' + Number(month.slice(5)) + '월';
    summary.textContent = '일정 ' + rows.filter(event => event.date.startsWith(month)).length + '개 · 날짜를 선택하면 상세 내용을 볼 수 있습니다.';
    body.replaceChildren();
    const dates = monthGrid(month);
    for (let index = 0; index < dates.length; index += 7) {
      const week = element('tr');
      for (const date of dates.slice(index, index + 7)) {
        const cell = element('td');
        if (date) cell.append(dateButton(date));
        else cell.className = 'calendar-empty';
        week.append(cell);
      }
      body.append(week);
    }
    showDetails();
    renderAgenda();
  }

  function changeMonth(value) {
    if (!validDate(value + '-01')) { input.value = month; return; }
    month = value;
    selected = month === today.slice(0, 7) ? today : rows.find(event => event.date.startsWith(month))?.date || month + '-01';
    renderMonth();
  }
  previous.addEventListener('click', () => changeMonth(moveMonth(month, -1)));
  next.addEventListener('click', () => changeMonth(moveMonth(month, 1)));
  current.addEventListener('click', () => changeMonth(today.slice(0, 7)));
  input.addEventListener('change', () => changeMonth(input.value));
  renderMonth();
}

export async function loadCalendars() {
  const [eventResult, imageResult] = await Promise.allSettled([jsonFile('data/events.json'), jsonFile('data/calendar.json')]);
  const images = imageResult.status === 'fulfilled' ? imageResult.value || {} : {};
  let events = [], warning = '';
  try {
    if (eventResult.status !== 'fulfilled') throw new Error('LOAD');
    events = validateEvents(eventResult.value);
  } catch { warning = '일정 데이터를 불러오지 못해 등록된 달력 이미지를 표시합니다.'; }
  for (const semester of ['26-2', '27-1']) {
    const target = $('calendar-container-' + semester);
    if (warning) calendarImage(target, images[semester], semester, warning);
    else renderCalendar(target, events, images[semester], semester);
  }
}
