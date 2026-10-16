import { assignInterviews, csvString, formatDate, slotsOf, publicFileUrl, createApi } from "./core.js";

const $ = id => document.getElementById(id);
const state = { api: null, applicants: [], assignments: [], initialized: false, listRequest: 0 };

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function message(target, text, type = "") {
  $(target).replaceChildren(element("p", text, "notice " + type));
}

async function jsonFile(path) {
  const response = await fetch(new URL(path, document.baseURI), { cache: "no-cache" });
  if (!response.ok) throw new Error("FILE");
  return response.json();
}

function renderTable(target, rows) {
  $(target).replaceChildren();
  if (!rows.length) return;
  const wrapper = element("div", undefined, "table-scroll");
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", target === "applicants-table" ? "전체 지원서 목록" : "면접 배정 결과");
  const table = element("table");
  const head = element("thead");
  const headRow = element("tr");
  const headers = Object.keys(rows[0]);
  for (const title of headers) {
    const cell = element("th", title);
    cell.scope = "col";
    headRow.append(cell);
  }
  head.append(headRow);
  const body = element("tbody");
  for (const row of rows) {
    const tr = element("tr");
    for (const header of headers) tr.append(element("td", String(row[header] ?? "")));
    body.append(tr);
  }
  table.append(head, body);
  wrapper.append(table);
  $(target).append(wrapper);
}

async function loadCalendar() {
  try {
    const calendar = await jsonFile("data/calendar.json");
    if (!calendar) { message("calendar-container", "아직 등록된 달력이 없습니다."); return; }
    const figure = element("figure", undefined, "calendar-figure");
    const img = element("img");
    img.alt = "2학기 일정";
    img.addEventListener("error", () => message("calendar-container", "달력 이미지를 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.", "error"));
    img.src = publicFileUrl(calendar.path, document.baseURI);
    figure.append(img, element("figcaption", "2학기 일정"));
    $("calendar-container").replaceChildren(figure);
  } catch { message("calendar-container", "달력 이미지를 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.", "error"); }
}

async function loadMaterials() {
  try {
    const files = await jsonFile("data/materials.json");
    if (!files.length) { message("materials-list", "아직 등록된 정모 자료가 없습니다."); return; }
    $("materials-list").replaceChildren();
    for (const [index, file] of files.entries()) {
      const card = element("article", undefined, "material-card");
      const link = element("a", "📥 PDF 다운로드", "download-link");
      link.href = publicFileUrl(file.path, document.baseURI);
      link.download = file.name;
      link.setAttribute("aria-label", file.name + " PDF 다운로드");
      const actions = element("div", undefined, "material-actions");
      const toggle = element("button", "미리보기");
      toggle.type = "button";
      toggle.setAttribute("aria-label", file.name + " 미리보기");
      toggle.setAttribute("aria-expanded", "false");
      const preview = element("div", undefined, "pdf-preview");
      preview.id = "pdf-preview-" + index;
      preview.hidden = true;
      toggle.setAttribute("aria-controls", preview.id);
      const fallback = element("p", undefined, "pdf-preview-help");
      const open = element("a", "새 탭에서 PDF 열기");
      open.href = link.href;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      fallback.append(document.createTextNode("미리보기가 표시되지 않으면 "), open, document.createTextNode("를 이용해 주세요."));
      preview.append(fallback);
      toggle.addEventListener("click", () => {
        const expanded = preview.hidden;
        preview.hidden = !expanded;
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.textContent = expanded ? "미리보기 닫기" : "미리보기";
        toggle.setAttribute("aria-label", file.name + (expanded ? " 미리보기 닫기" : " 미리보기"));
        if (expanded && !preview.querySelector("iframe")) {
          const frame = element("iframe", undefined, "pdf-frame");
          frame.title = file.name + " 미리보기";
          frame.loading = "lazy";
          frame.src = link.href + "#view=FitH";
          preview.prepend(frame);
        }
      });
      actions.append(toggle, link);
      card.append(element("p", file.title, "material-title"), element("p", `PDF · ${(file.size / 1048576).toFixed(2)} MB`, "material-meta"), actions, preview);
      $("materials-list").append(card);
    }
  } catch { message("materials-list", "자료를 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.", "error"); }
}

function renderContent(content) {
  $("introduction").textContent = content.introduction;
  for (const item of content.schedule) {
    const li = element("li");
    li.append(element("strong", item.week + ":"), document.createTextNode(" " + item.text));
    $("schedule-list").append(li);
  }
  content.interviewSlots.forEach((slot, index) => {
    const label = element("label");
    const input = element("input");
    input.type = "checkbox";
    input.name = "slots";
    input.value = slot;
    input.id = "slot-" + index;
    label.append(input, document.createTextNode(slot));
    $("interview-slots").append(label);
  });
}

async function refreshApplicants() {
  if (!state.api) return;
  const request = ++state.listRequest;
  $("refresh-applicants").disabled = true;
  $("assign-interviews").disabled = true;
  state.applicants = [];
  state.assignments = [];
  $("applicants-table").replaceChildren();
  $("assignment-result").hidden = true;
  message("applicants-status", "지원서를 불러오는 중입니다.");
  try {
    const rows = await state.api.list();
    if (request !== state.listRequest) return;
    state.applicants = rows;
    if (!rows.length) { message("applicants-status", "아직 접수된 지원서가 없습니다."); return; }
    $("applicants-status").replaceChildren(element("h3", `전체 지원서 목록 (총 ${rows.length}명)`));
    renderTable("applicants-table", rows.map(row => ({
      "지원서코드": row.id, "이름": row.name, "학번": row.student_id,
      "연락처": row.phone, "면접 가능 시간": slotsOf(row).join(", ") || "선택 안함",
      "지원 사유": row.motive, "접수 일시": formatDate(row.created_at)
    })));
    $("assign-interviews").disabled = false;
  } catch { if (request === state.listRequest) message("applicants-status", "데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "error"); }
  finally { if (request === state.listRequest) $("refresh-applicants").disabled = false; }
}

function showView(moveFocus = false) {
  const requested = location.hash.slice(1);
  const view = ["about", "schedule", "recruitment"].includes(requested) ? requested : "about";
  for (const section of document.querySelectorAll(".view")) section.hidden = section.id !== view;
  for (const link of document.querySelectorAll("[data-view]")) {
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (moveFocus) $("main").focus({ preventScroll: true });
  if (view === "recruitment" && state.initialized) refreshApplicants();
}

function showTab(name, focus = false) {
  for (const tabName of ["apply", "lookup"]) {
    const active = name === tabName;
    $(tabName + "-tab").setAttribute("aria-selected", String(active));
    $(tabName + "-tab").tabIndex = active ? 0 : -1;
    $(tabName + "-panel").hidden = !active;
  }
  if (focus) $(name + "-tab").focus();
}

for (const name of ["apply", "lookup"]) {
  $(name + "-tab").addEventListener("click", () => showTab(name));
  $(name + "-tab").addEventListener("keydown", event => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? "apply" : event.key === "End" ? "lookup" : name === "apply" ? "lookup" : "apply";
      showTab(next, true);
    }
  });
}

$("application-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.api || $("application-fields").disabled) return;
  const data = new FormData(event.currentTarget);
  const values = Object.fromEntries(["name", "student_id", "phone", "motive"].map(key => [key, String(data.get(key) || "").trim()]));
  values.slots = data.getAll("slots");
  if (Object.values(values).some(value => !value.length)) {
    message("submit-status", "⚠️ 모든 필드와 면접 가능 일정을 최소 1개 이상 선택해 주세요.", "warning");
    return;
  }
  $("application-fields").disabled = true;
  message("submit-status", "지원서를 제출하는 중입니다.");
  try {
    const code = await state.api.submit(values);
    message("submit-status", `🎉 성공적으로 접수되었습니다! 본인의 지원서 코드는 [${code}] 입니다.\n원할 경우 언제든지 지원서 코드를 이용해 본인의 지원서를 조회할 수 있습니다.`, "success");
    $("application-form").reset();
    refreshApplicants();
  } catch (error) {
    message("submit-status", error.code === "23505"
      ? "⚠️ 이미 해당 학번으로 신청한 내역이 존재합니다."
      : "데이터 저장 중 오류가 발생했습니다. 제출 내역을 확인하거나 운영진에게 문의해 주세요.", error.code === "23505" ? "warning" : "error");
  } finally { $("application-fields").disabled = false; }
});

$("lookup-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.api || $("lookup-button").disabled) return;
  const code = $("application-code").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) { message("lookup-result", "지원서 코드를 입력해 주세요.", "warning"); return; }
  $("lookup-button").disabled = true;
  message("lookup-result", "제출 내역을 확인하는 중입니다.");
  try {
    const row = await state.api.lookup(code);
    if (!row) { message("lookup-result", "❌ 일치하는 지원서 코드가 없습니다.", "error"); return; }
    message("lookup-result", `✅ ${row.name}님의 지원서는 다음과 같습니다.`, "success");
    for (const [label, value] of Object.entries({ "학번": row.student_id, "연락처": row.phone, "지원 사유": row.motive, "선택한 면접 일정": slotsOf(row).join(", ") || "없음", "접수 일시": formatDate(row.created_at) })) {
      const item = element("p", undefined, "detail-row");
      item.append(element("strong", label + ": "), document.createTextNode(String(value ?? "")));
      $("lookup-result").append(item);
    }
  } catch { message("lookup-result", "조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "error"); }
  finally { $("lookup-button").disabled = false; }
});

$("refresh-applicants").addEventListener("click", refreshApplicants);
$("assign-interviews").addEventListener("click", () => {
  if (!state.applicants.length) return;
  state.assignments = assignInterviews(state.applicants);
  renderTable("assignment-table", state.assignments);
  $("assignment-result").hidden = false;
});
$("download-csv").addEventListener("click", () => {
  if (!state.assignments.length) return;
  const url = URL.createObjectURL(new Blob([csvString(state.assignments)], { type: "text/csv;charset=utf-8" }));
  const link = element("a");
  link.href = url;
  link.download = "면접배정결과.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener("hashchange", () => showView(true));

async function initialize() {
  showView();
  $("application-fields").disabled = true;
  $("lookup-button").disabled = true;
  $("refresh-applicants").disabled = true;
  const contentTask = jsonFile("data/content.json").then(renderContent).catch(() => {
    $("introduction").textContent = "내용을 불러올 수 없습니다. 페이지를 새로고침해 주세요.";
    message("schedule-list", "일정을 불러올 수 없습니다.", "error");
    throw new Error("CONTENT");
  });
  loadCalendar();
  loadMaterials();
  try {
    const [config] = await Promise.all([jsonFile("config.json"), contentTask]);
    state.api = createApi(config);
    $("application-fields").disabled = false;
    $("lookup-button").disabled = false;
    $("refresh-applicants").disabled = false;
  } catch { message("connection-status", "모집 기능에 연결할 수 없습니다. 운영진에게 문의해 주세요.", "error"); }
  state.initialized = true;
  if (location.hash === "#recruitment") refreshApplicants();
}

initialize();
