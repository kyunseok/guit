const node = (tag, text, className) => {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
};

export function setlistEntries(result) {
  const columns = result.headers.map((label, index) => ({ label, index })).filter(({ label }) => label.replace(/\s/g, '') !== '구분');
  let group = '';
  const entries = [];
  for (const row of result.rows) {
    if (/^\d+\s*조$/.test(row[0]?.trim())) group = row[0].trim();
    if (columns.some(({ index }) => row[index]?.trim())) entries.push({ row, group, example: /^예시/.test(row[0]?.trim()) });
  }
  return { columns, entries };
}

function appendValue(target, value) {
  if (/^https?:\/\/\S+$/.test(value)) {
    const link = node('a', '링크 열기');
    link.href = value;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    target.append(link);
  } else target.textContent = value || '—';
}

function feedbackButton(title, entry, context, openFeedback, compact) {
  const button = node('button', compact ? '피드백 보기 · 작성' : title, compact ? 'song-feedback-action' : 'song-feedback-link');
  button.type = 'button';
  button.setAttribute('aria-label', title + ' 피드백 보기 및 작성');
  button.addEventListener('click', () => { void openFeedback({ title: title.trim(), performance: context.feedbackTitle, sheetUrl: context.sheetUrl, group: entry.group }, button); });
  return button;
}

function songCard(entry, columns, context, openFeedback) {
  const { row, example } = entry;
  const title = row[context.songColumn] || '';
  const artist = columns.find(({ label }) => /^(가수|아티스트|원곡자|artist)$/i.test(label.trim()));
  const card = node('details', undefined, 'song-card');
  const summary = node('summary');
  const text = node('span', undefined, 'song-summary');
  text.append(node('strong', title.trim() || '곡명 미입력'));
  if (example) text.append(node('span', '예시', 'song-artist'));
  if (artist && row[artist.index]?.trim()) text.append(node('span', row[artist.index], 'song-artist'));
  summary.append(text);
  const details = node('div', undefined, 'song-details');
  const list = node('dl');
  for (const { label, index } of columns) {
    if (index === context.songColumn || !row[index]?.trim()) continue;
    const value = node('dd');
    appendValue(value, row[index]);
    list.append(node('dt', label), value);
  }
  details.append(list);
  if (title.trim() && !example) details.append(feedbackButton(title, entry, context, openFeedback, true));
  card.append(summary, details);
  return card;
}

export function renderSetlist(result, context, openFeedback) {
  const { columns, entries } = setlistEntries(result);
  const root = node('div', undefined, 'setlist-content');
  const searchLabel = node('label', '곡명·이름 검색', 'setlist-search');
  const search = node('input');
  search.type = 'search';
  search.placeholder = '곡명, 가수 또는 참여자 이름';
  search.autocomplete = 'off';
  searchLabel.append(search);
  const matches = node('p', undefined, 'muted setlist-count');
  matches.setAttribute('role', 'status');
  const empty = node('p', '검색 결과가 없습니다. 다른 이름이나 곡명을 입력해 주세요.', 'notice');
  empty.hidden = true;
  const options = node('div', undefined, 'setlist-view-options');
  options.setAttribute('aria-label', '셋리스트 보기 방식');
  const buttons = ['곡별 보기', '표로 보기'].map((label, index) => {
    const button = node('button', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === 0));
    button.addEventListener('click', () => {
      root.classList.toggle('show-table', index === 1);
      buttons.forEach((item, selected) => item.setAttribute('aria-pressed', String(selected === index)));
    });
    options.append(button);
    return button;
  });
  const cards = node('div', undefined, 'song-list');
  const wrapper = node('div', undefined, 'table-scroll setlist-scroll');
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', context.feedbackTitle + ' 셋리스트');
  const table = node('table', undefined, 'setlist-table');
  const head = node('thead'), header = node('tr'), body = node('tbody');
  for (const { label, index } of columns) {
    const th = node('th', label, index === context.songColumn ? 'setlist-song' : undefined);
    th.scope = 'col';
    header.append(th);
  }
  const searchable = [];
  for (const entry of entries) {
    const tr = node('tr');
    for (const { index } of columns) {
      const value = entry.row[index] || '';
      const cell = node('td', undefined, index === context.songColumn ? 'setlist-song' : undefined);
      if (index === context.songColumn && value.trim() && !entry.example) cell.append(feedbackButton(value, entry, context, openFeedback, false));
      else appendValue(cell, value);
      tr.append(cell);
    }
    body.append(tr);
    const card = songCard(entry, columns, context, openFeedback);
    cards.append(card);
    searchable.push({ tr, card, text: columns.map(({ index }) => entry.row[index] || '').join(' ').normalize('NFC').toLocaleLowerCase() });
  }
  head.append(header);
  table.append(head, body);
  wrapper.append(table);
  const filter = () => {
    const terms = search.value.normalize('NFC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const item of searchable) {
      const visible = terms.every(term => item.text.includes(term));
      item.tr.hidden = item.card.hidden = !visible;
      if (visible) count++;
    }
    matches.textContent = terms.length ? entries.length + '개 중 ' + count + '개 표시' : '전체 ' + count + '개';
    empty.hidden = count > 0 || !terms.length;
  };
  search.addEventListener('input', filter);
  filter();
  root.append(searchLabel, options, matches, empty, cards, wrapper);
  return { root, count: entries.length };
}
