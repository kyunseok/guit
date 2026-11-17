const HOUR = 60 * 60 * 1000;
const KST = 9 * HOUR;

export function koreaInput(value = Date.now()) {
  return new Date(new Date(value).getTime() + KST).toISOString().slice(0, 16);
}

export function koreaTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const time = new Date(value + ':00+09:00').getTime();
  return Number.isFinite(time) && koreaInput(time) === value ? time : NaN;
}

export function reservationValues(values, now = Date.now()) {
  const start = koreaTime(values.start), end = koreaTime(values.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('시작 일시와 종료 일시를 입력해 주세요.');
  if (start <= now) throw new Error('예약 시작은 현재 시각 이후로 선택해 주세요.');
  if (end <= start) throw new Error('종료 일시는 시작 일시보다 늦어야 합니다.');
  if (end - start > 2 * HOUR) throw new Error('동방은 한 번에 최대 2시간까지 예약할 수 있습니다.');
  const purpose = values.purpose.trim(), people = Number(values.people);
  if (!purpose || purpose.length > 300) throw new Error('사용 목적을 1~300자로 입력해 주세요.');
  if (!Number.isInteger(people) || people < 1 || people > 2147483647) throw new Error('사용 인원을 1명 이상의 정수로 입력해 주세요.');
  return { starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), purpose, people };
}

export function reservationsOverlap(a, b) {
  return new Date(a.starts_at) < new Date(b.ends_at) && new Date(b.starts_at) < new Date(a.ends_at);
}

export function initializeReservations(getApi) {
  const $ = id => document.getElementById(id);
  const form = $('reservation-form'), fields = $('reservation-fields');
  const start = $('reservation-start'), end = $('reservation-end'), day = $('reservation-day');
  const submit = $('reservation-submit');
  let visible = false, connected = false, busy = false, request = 0, pending = null;

  function note(target, text, type = '') {
    const p = document.createElement('p');
    p.className = 'notice ' + type;
    p.textContent = text;
    $(target).replaceChildren(p);
  }

  function limits() {
    start.min = koreaInput(Math.ceil(Date.now() / 60000) * 60000);
    const time = koreaTime(start.value);
    if (Number.isFinite(time)) {
      end.min = koreaInput(time + 60000);
      end.max = koreaInput(time + 2 * HOUR);
    }
  }

  function render(rows) {
    const list = $('reservation-list');
    list.replaceChildren();
    if (!rows.length) {
      note('reservation-list', '이 날짜에는 등록된 예약이 없습니다.');
      return;
    }
    const time = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    for (const row of rows) {
      const card = document.createElement('article');
      card.className = 'reservation-card';
      const heading = document.createElement('h4');
      heading.textContent = time.format(new Date(row.starts_at)) + ' – ' + time.format(new Date(row.ends_at));
      const purpose = document.createElement('p');
      purpose.className = 'reservation-purpose';
      purpose.textContent = row.purpose;
      const count = document.createElement('p');
      count.className = 'muted';
      count.textContent = row.people + '명 · ' + Math.round((new Date(row.ends_at) - new Date(row.starts_at)) / 60000) + '분';
      card.append(heading, purpose, count);
      list.append(card);
    }
  }

  async function refresh() {
    if (!visible || !getApi()) return;
    const from = koreaTime(day.value + 'T00:00');
    if (!Number.isFinite(from)) return;
    const current = ++request;
    note('reservation-list', '예약 현황을 불러오는 중입니다.');
    try {
      const rows = await getApi().reservationsList(new Date(from).toISOString(), new Date(from + 24 * HOUR).toISOString());
      if (current === request && visible) render(rows);
    } catch {
      if (current === request && visible) note('reservation-list', '예약 현황을 불러오지 못했습니다. 새로고침을 눌러 다시 확인해 주세요.', 'error');
    }
  }

  const initial = Math.ceil((Date.now() + 60000) / (30 * 60000)) * 30 * 60000;
  start.value = koreaInput(initial);
  end.value = koreaInput(initial + HOUR);
  day.value = start.value.slice(0, 10);
  limits();
  fields.disabled = true;

  start.addEventListener('change', () => {
    limits();
    const time = koreaTime(start.value), finish = koreaTime(end.value);
    if (Number.isFinite(time)) {
      if (!Number.isFinite(finish) || finish <= time || finish - time > 2 * HOUR) end.value = koreaInput(time + HOUR);
      day.value = start.value.slice(0, 10);
      refresh();
    }
  });
  day.addEventListener('change', refresh);
  $('reservation-refresh').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { limits(); refresh(); } });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !getApi()) return;
    let values;
    try {
      values = reservationValues({ start: start.value, end: end.value, purpose: $('reservation-purpose').value, people: $('reservation-people').value });
    } catch (error) { note('reservation-status', error.message, 'error'); return; }
    const signature = JSON.stringify(values);
    if (!pending || pending.signature !== signature) pending = { signature, id: crypto.randomUUID() };
    const id = pending.id;
    busy = true;
    fields.disabled = true;
    submit.textContent = '예약 중…';
    note('reservation-status', '예약을 확인하고 있습니다.');
    try {
      await getApi().reservationSubmit({ id, ...values });
      pending = null;
      note('reservation-status', '예약이 완료되었습니다.', 'success');
      $('reservation-purpose').value = '';
      day.value = start.value.slice(0, 10);
      await refresh();
    } catch (error) {
      const messages = {
        '23P01': '이미 예약된 시간과 겹칩니다. 예약 현황을 확인하고 다른 시간을 선택해 주세요.',
        '23514': '예약 내용을 확인해 주세요. 이용 시간은 최대 2시간이며 사용 인원은 1명 이상이어야 합니다.',
        '42501': '예약할 수 없습니다. 시작 시각이 지났는지 확인한 뒤 다시 시도해 주세요.'
      };
      note('reservation-status', messages[error.code] || '예약 결과를 확인하지 못했습니다. 입력 내용을 유지한 채 예약하기를 다시 눌러 주세요.', 'error');
      if (error.code === '23P01') { day.value = start.value.slice(0, 10); await refresh(); }
    } finally {
      busy = false;
      fields.disabled = !connected;
      submit.textContent = '예약하기';
      limits();
    }
  });

  return {
    show(value) {
      const entering = value && !visible;
      visible = value;
      if (!value) request++;
      if (entering) { limits(); refresh(); }
    },
    connect() {
      connected = Boolean(getApi());
      fields.disabled = !connected || busy;
      if (connected) { $('reservation-status').replaceChildren(); refresh(); }
      else {
        note('reservation-status', '예약 기능에 연결하지 못했습니다. 페이지를 새로고침해 주세요.', 'error');
        note('reservation-list', '예약 현황에 연결하지 못했습니다.', 'error');
      }
    }
  };
}
