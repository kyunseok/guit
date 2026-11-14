export async function feedbackKey(sheetUrl, title, group = "") {
  const url = new URL(sheetUrl);
  const sheet = url.pathname.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1];
  if (!sheet) throw new Error("INVALID_SHEET");
  const normalize = value => value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  const gid = url.searchParams.get("gid") || new URLSearchParams(url.hash.slice(1)).get("gid") || "0";
  const value = JSON.stringify([sheet, gid, normalize(group), normalize(title)]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function initializeFeedback(getApi, formatDate) {
  const $ = id => document.getElementById(id);
  const dialog = $("feedback-dialog");
  const drafts = new Map(), submissionIds = new Map(), pending = new Set();
  let selected = null, version = 0, listRequest = 0, rows = [], trigger = null;
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function status(id, text, error = false) {
    $(id).replaceChildren(node("p", text, error ? "notice error" : "muted"));
  }
  function saveDraft() {
    if (selected) drafts.set(selected.key, { author: $("feedback-author").value, body: $("feedback-body").value });
  }
  function renderRows() {
    $("feedback-list").replaceChildren();
    for (const row of rows) {
      const card = node("article", undefined, "feedback-card");
      card.append(node("strong", row.author_name), node("time", formatDate(row.created_at), "muted"), node("p", row.body, "feedback-body"));
      $("feedback-list").append(card);
    }
  }
  async function load(more = false) {
    if (!selected || !getApi()) return;
    const current = version, request = ++listRequest, key = selected.key;
    $("feedback-more").disabled = true;
    status("feedback-status", "피드백을 불러오는 중입니다.");
    try {
      const page = await getApi().feedbackList(key, more ? rows.length : 0);
      if (current !== version || request !== listRequest) return;
      const combined = more ? [...rows, ...page.rows] : page.rows;
      rows = [...new Map(combined.map(row => [row.id, row])).values()];
      renderRows();
      if (rows.length) $("feedback-status").replaceChildren();
      else status("feedback-status", "아직 피드백이 없습니다. 첫 의견을 남겨 주세요.");
      $("feedback-more").hidden = Number.isFinite(page.total) ? rows.length >= page.total : page.rows.length < 50;
    } catch {
      if (current !== version || request !== listRequest) return;
      status("feedback-status", "피드백을 불러오지 못했습니다.", true);
      const retry = node("button", "다시 불러오기");
      retry.type = "button";
      retry.addEventListener("click", () => load(more));
      $("feedback-status").append(retry);
    } finally { if (current === version && request === listRequest) $("feedback-more").disabled = false; }
  }
  $("feedback-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    saveDraft();
    version++;
    selected = null;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
  $("feedback-more").addEventListener("click", () => load(true));
  $("feedback-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!selected || !getApi() || $("feedback-fields").disabled) return;
    const current = version, song = selected;
    const author = $("feedback-author").value.trim() || "익명";
    const body = $("feedback-body").value.trim();
    if (!body) { status("feedback-submit-status", "피드백 내용을 입력해 주세요.", true); return; }
    const signature = JSON.stringify([song.key, author, body]);
    if (pending.has(signature)) return;
    if (!submissionIds.has(signature)) submissionIds.set(signature, crypto.randomUUID());
    pending.add(signature);
    $("feedback-fields").disabled = true;
    status("feedback-submit-status", "피드백을 저장하는 중입니다.");
    try {
      await getApi().feedbackSubmit({ id: submissionIds.get(signature), song_key: song.key, song_title: song.title, performance: song.performance, author_name: author, body });
      drafts.delete(song.key);
      if (current !== version) return;
      $("feedback-body").value = "";
      status("feedback-submit-status", "피드백을 남겼습니다.");
      await load();
    } catch {
      if (current === version) status("feedback-submit-status", "저장 결과를 확인하지 못했습니다. 다시 눌러도 같은 피드백은 중복 등록되지 않습니다.", true);
    } finally {
      pending.delete(signature);
      if (current === version) $("feedback-fields").disabled = false;
    }
  });
  return async function openFeedback(song, source) {
    saveDraft();
    const current = ++version;
    selected = null;
    trigger = source;
    rows = [];
    $("feedback-form").reset();
    $("feedback-fields").disabled = true;
    $("feedback-song").textContent = song.title;
    $("feedback-context").textContent = [song.performance, song.group].filter(Boolean).join(" · ");
    $("feedback-list").replaceChildren();
    $("feedback-submit-status").replaceChildren();
    $("feedback-more").hidden = true;
    status("feedback-status", "피드백을 불러오는 중입니다.");
    if (!dialog.open) dialog.showModal();
    try {
      const key = await feedbackKey(song.sheetUrl, song.title, song.group);
      if (current !== version || !dialog.open) return;
      selected = { ...song, key };
      const draft = drafts.get(key);
      if (draft) { $("feedback-author").value = draft.author; $("feedback-body").value = draft.body; }
      if (!getApi()) throw new Error("CONNECTION");
      $("feedback-fields").disabled = false;
      await load();
    } catch { if (current === version) status("feedback-status", "피드백 기능에 연결하지 못했습니다. 잠시 후 곡 제목을 다시 눌러 주세요.", true); }
  };
}
