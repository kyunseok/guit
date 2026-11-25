import { initializeTimetable } from "./timetable.js";
import { HOUR, koreaInput, koreaTime, koreaMonthRange, reservationTimes, reservationValues, reservationsOverlap } from "./reservation-rules.js";

export function initializeReservations(getApi) {
  const $ = id => document.getElementById(id);
  const form = $('reservation-form'), fields = $('reservation-fields');
  const start = $('reservation-start'), end = $('reservation-end'), month = $('reservation-month');
  const submit = $('reservation-submit');
  const bookDate = $('reservation-book-date');
  let display = 'timetable';
  const dialog = $('reservation-detail');
  $('reservation-detail-close').addEventListener('click', () => dialog.close());
  const timetable = initializeTimetable(() => { if (display !== 'list') void refresh(); }, openDetail, () => display === 'day', bookSlot);

  function bookSlot(row) {
    if (busy || !connected) return;
    if (Date.parse(row.starts_at) <= Date.now()) {
      note('reservation-list-status', '선택한 시각이 지났습니다. 새로고침 후 다른 시간을 선택해 주세요.', 'error');
      return;
    }
    bookDate.value = koreaInput(row.starts_at).slice(0, 10);
    start.value = koreaInput(row.starts_at).slice(11);
    end.value = koreaInput(row.ends_at).slice(11);
    limits();
    $('reservation-prefill').hidden = false;
    $('reservation-prefill').textContent = bookDate.value + ' · ' + start.value + ' – ' + end.value + ' 선택됨. 내용을 확인한 뒤 예약하기를 눌러 주세요.';
    $('reservation-status').replaceChildren();
    window.location.hash = 'room-reservation/book';
  }

  function openDetail(row) {
    $('reservation-detail-content').replaceChildren(createCard(row, 'detail'));
    dialog.showModal();
  }
  let visible = false, selected = 'book', connected = false, busy = false, request = 0, pending = null;

  function note(target, text, type = '') {
    const p = document.createElement('p');
    p.className = 'notice ' + type;
    p.textContent = text;
    $(target).replaceChildren(p);
  }

  function limits() {
    bookDate.min = koreaInput().slice(0, 10);
    const hint = $('reservation-time-help');
    try {
      const times = reservationTimes(bookDate.value, start.value, end.value);
      const minutes = (koreaTime(times.end) - koreaTime(times.start)) / 60000;
      hint.textContent = (times.nextDay ? '다음 날 ' + times.end.slice(5, 10).replace('-', '/') + ' 종료 · ' : '') + (minutes > 0 ? minutes + '분 이용' : '종료 시각을 확인해 주세요.');
      if (minutes > 120) hint.textContent += ' · 최대 2시간까지 가능합니다.';
    } catch { hint.textContent = ''; }
  }

  function render(rows) {
    const list = $('reservation-list');
    list.replaceChildren();
    if (!rows.length) {
      note('reservation-list', display === 'day' ? '이 날에는 등록된 예약이 없습니다.' : '이 달에는 등록된 예약이 없습니다.');
      return;
    }
    let previousDay = '';
    for (const row of rows) {
      const day = koreaInput(row.starts_at).slice(0, 10);
      if (display === 'list' && previousDay !== day) {
        const heading = document.createElement('h3');
        heading.className = 'reservation-day-heading';
        heading.textContent = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(row.starts_at));
        list.append(heading);
        previousDay = day;
      }
      list.append(createSummary(row));
    }
  }

  function createSummary(row) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reservation-summary' + (row.is_fixed ? ' fixed' : '');
    button.setAttribute('aria-haspopup', 'dialog');
    const time = document.createElement('strong');
    const startDay = koreaInput(row.starts_at).slice(0, 10), endDay = koreaInput(row.ends_at).slice(0, 10);
    const overnight = startDay !== endDay;
    time.textContent = koreaInput(row.starts_at).slice(11) + ' – ' + (overnight ? '다음 날 ' : '') + koreaInput(row.ends_at).slice(11);
    if (display === 'day' && startDay < $('reservation-date').value) time.textContent = '전날 ' + time.textContent.replace('다음 날 ', '');
    const user = document.createElement('span');
    user.className = 'reservation-summary-user';
    user.textContent = row.user_name || '미입력';
    const meta = document.createElement('span');
    meta.className = 'reservation-summary-meta';
    meta.textContent = row.purpose + ' · ' + row.people + '명' + (row.is_fixed ? ' · 고정 일정' : '');
    button.append(time, user, meta);
    button.addEventListener('click', () => openDetail(row));
    return button;
  }

  function createCard(row, context) {
    const time = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
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
      const user = document.createElement('p');
      user.className = 'reservation-user';
      user.textContent = '사용자: ' + (row.user_name || '미입력');
      card.append(heading, user, purpose, count);
      if (row.is_fixed) {
        const badge = document.createElement('p');
        badge.className = 'reservation-fixed-label';
        badge.textContent = '매주 반복 · 고정 일정';
        card.append(badge);
      } else addCancellation(card, row, context);
    return card;
  }

  function addCancellation(card, row, context) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'reservation-cancel';
    action.textContent = '예약 취소';
    const cancelForm = document.createElement('form');
    cancelForm.className = 'reservation-cancel-form';
    cancelForm.hidden = true;
    const label = document.createElement('label');
    const password = document.createElement('input');
    password.id = 'cancel-password-' + context + '-' + row.id;
    password.type = 'password';
    password.maxLength = 128;
    password.autocomplete = 'current-password';
    password.required = true;
    label.htmlFor = password.id;
    label.textContent = '취소 비밀번호';
    const confirm = document.createElement('button');
    confirm.type = 'submit';
    confirm.className = 'reservation-cancel';
    confirm.textContent = '예약 취소';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '닫기';
    const actions = document.createElement('div');
    actions.className = 'reservation-cancel-actions';
    actions.append(confirm, close);
    const message = document.createElement('output');
    message.className = 'reservation-cancel-message';
    let cancelling = false;
    function openPassword() {
      cancelForm.hidden = false;
      action.hidden = true;
      password.focus();
    }
    close.addEventListener('click', () => {
      cancelForm.hidden = true;
      action.hidden = false;
      password.value = '';
      message.textContent = '';
      action.focus();
    });
    async function cancel(value) {
      if (cancelling || !getApi()) return;
      cancelling = true;
      action.disabled = confirm.disabled = close.disabled = password.disabled = true;
      message.textContent = '예약을 취소하는 중입니다.';
      try {
        const result = await getApi().reservationCancel(row.id, value);
        if (result === 'cancelled' || result === 'already_cancelled') {
          password.value = '';
          note('reservation-list-status', '예약이 취소되었습니다.', 'success');
          if (dialog.open) dialog.close();
          await refresh();
          if (visible && selected === 'list') $('reservation-refresh').focus({ preventScroll: true });
        } else if (result === 'password_required') {
          message.textContent = '예약 시 설정한 비밀번호를 입력해 주세요.';
          openPassword();
        } else {
          const errors = { invalid_password: '비밀번호가 일치하지 않습니다.', rate_limited: '입력 횟수를 초과했습니다. 5분 후 다시 시도해 주세요.', unavailable: '예약을 취소할 수 없습니다. 잠시 후 다시 시도해 주세요.' };
          message.textContent = errors[result];
        }
      } catch {
        message.textContent = '취소 결과를 확인하지 못했습니다. 다시 시도하거나 예약 현황을 새로고침해 주세요.';
      } finally {
        cancelling = false;
        action.disabled = confirm.disabled = close.disabled = password.disabled = false;
        if (!cancelForm.hidden && card.isConnected) password.focus();
      }
    }
    action.addEventListener('click', () => { if (row.has_password) openPassword(); else void cancel(''); });
    cancelForm.addEventListener('submit', event => { event.preventDefault(); void cancel(password.value); });
    cancelForm.append(label, password, actions);
    card.append(action, cancelForm, message);
  }

  async function refresh() {
    if (!visible || selected !== 'list' || !getApi()) return;
    const current = ++request;
    const target = display === 'timetable' ? 'reservation-timetable-status' : 'reservation-list';
    const range = display === 'list' ? koreaMonthRange(month.value) : timetable.range();
    if (display === 'timetable') timetable.clear();
    if (!range) { note(target, '조회할 날짜를 선택해 주세요.'); return; }
    note(target, '예약 현황을 불러오는 중입니다.');
    try {
      const [bookings, fixed] = await Promise.all([getApi().reservationsList(range.from, range.to), getApi().fixedReservationsList(range.from, range.to)]);
      const rows = [...bookings, ...fixed].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      if (current !== request || !visible) return;
      if (display === 'timetable') {
        $(target).replaceChildren();
        if (!rows.length) note(target, '이 기간에는 등록된 예약이 없습니다.');
        timetable.render(rows);
      } else render(rows);
    } catch {
      if (current === request && visible) note(target, '예약 현황을 불러오지 못했습니다. 새로고침을 눌러 다시 확인해 주세요.', 'error');
    }
  }

  function updateDisplay() {
    $('reservation-timetable-panel').hidden = display !== 'timetable';
    $('reservation-list').hidden = display === 'timetable';
    $('reservation-month-field').hidden = display !== 'list';
    $('reservation-month-toolbar').hidden = display !== 'list';
    $('reservation-date-toolbar').hidden = display === 'list';
    $('reservation-period').hidden = display === 'list';
    for (const mode of ['day', 'timetable', 'list']) $('reservation-view-' + mode).setAttribute('aria-pressed', String(mode === display));
    timetable.updatePeriod();
  }

  for (const mode of ['day', 'timetable', 'list']) {
    $('reservation-view-' + mode).addEventListener('click', () => {
      display = mode;
      updateDisplay();
      void refresh();
    });
  }
  updateDisplay();

  const initial = Math.ceil((Date.now() + 60000) / (30 * 60000)) * 30 * 60000;
  bookDate.value = koreaInput(initial).slice(0, 10);
  start.value = koreaInput(initial).slice(11);
  end.value = koreaInput(initial + HOUR).slice(11);
  month.value = bookDate.value.slice(0, 7);
  limits();
  fields.disabled = true;

  for (const input of [bookDate, start, end]) input.addEventListener('change', () => { $('reservation-prefill').hidden = true; limits(); });
  month.addEventListener('change', () => { void refresh(); });
  $('reservation-refresh').addEventListener('click', () => { void refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { limits(); void refresh(); } });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !getApi()) return;
    let values;
    try {
      values = reservationValues({ ...reservationTimes(bookDate.value, start.value, end.value), user_name: $('reservation-user').value, purpose: $('reservation-purpose').value, people: $('reservation-people').value, password: $('reservation-password').value });
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
      $('reservation-prefill').hidden = true;
      note('reservation-status', '예약이 완료되었습니다.', 'success');
      $('reservation-purpose').value = '';
      $('reservation-password').value = '';
      month.value = bookDate.value.slice(0, 7);
      await refresh();
    } catch (error) {
      const messages = {
        'P0001': '기타교실 고정 시간과 겹칩니다. 예약 현황에서 고정 일정을 확인하고 다른 시간을 선택해 주세요.',
        '23P01': '이미 예약된 시간과 겹칩니다. 예약 현황 탭을 확인하고 다른 시간을 선택해 주세요.',
        '23514': '예약 내용을 확인해 주세요. 사용자와 예약 목적을 입력하고, 이용 시간은 최대 2시간, 사용 인원은 1명 이상으로 설정해 주세요.',
        '42501': '예약할 수 없습니다. 시작 시각이 지났는지 확인한 뒤 다시 시도해 주세요.'
      };
      note('reservation-status', messages[error.code] || '예약 결과를 확인하지 못했습니다. 입력 내용을 유지한 채 예약하기를 다시 눌러 주세요.', 'error');
      if (error.code === '23P01') { month.value = bookDate.value.slice(0, 7); await refresh(); }
    } finally {
      busy = false;
      fields.disabled = !connected;
      submit.textContent = '예약하기';
      limits();
    }
  });

  return {
    show(value, tab) {
      const next = tab === 'list' ? 'list' : 'book';
      const entering = value && (!visible || selected !== next);
      if (!value || selected !== next) { request++; if (dialog.open) dialog.close(); }
      visible = value;
      selected = next;
      $('reservation-book-panel').hidden = next !== 'book';
      $('reservation-list-panel').hidden = next !== 'list';
      $('reservation-title').textContent = next === 'list' ? '예약 현황' : '동방(4층홀) 예약';
      for (const link of $('reservation-nav').querySelectorAll('a')) {
        if (link.dataset.reservationTab === next) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      if (entering) { limits(); void refresh(); }
    },
    connect() {
      connected = Boolean(getApi());
      fields.disabled = !connected || busy;
      if (connected) { $('reservation-status').replaceChildren(); void refresh(); }
      else {
        note('reservation-status', '예약 기능에 연결하지 못했습니다. 페이지를 새로고침해 주세요.', 'error');
        note('reservation-list', '예약 현황에 연결하지 못했습니다.', 'error');
      }
    }
  };
}
