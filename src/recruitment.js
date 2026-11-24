import { $, element, message } from "./ui.js";
import { formatDate } from "./dates.js";
import { assignInterviews, csvString, slotsOf } from "./recruitment-rules.js";

export function initializeRecruitment(getApi) {
  const state = { applicants: [], assignments: [], listRequest: 0, adminPassword: "" };

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

  function lockAdmin() {
    state.listRequest++;
    state.adminPassword = "";
    state.applicants = [];
    state.assignments = [];
    $("admin-panel").hidden = true;
    $("admin-login-form").hidden = false;
    $("admin-login-form").reset();
    $("admin-login-status").replaceChildren();
    $("applicants-status").replaceChildren();
    $("applicants-table").replaceChildren();
    $("assignment-table").replaceChildren();
    $("assignment-result").hidden = true;
    $("assign-interviews").disabled = true;
  }

  async function refreshApplicants(password = state.adminPassword) {
    if (!getApi() || !password) return;
    const request = ++state.listRequest;
    $("refresh-applicants").disabled = true;
    $("assign-interviews").disabled = true;
    state.applicants = [];
    state.assignments = [];
    $("applicants-table").replaceChildren();
    $("assignment-result").hidden = true;
    message("applicants-status", "지원서를 불러오는 중입니다.");
    try {
      const rows = await getApi().list(password);
      if (request !== state.listRequest) return;
      state.adminPassword = password;
      $("admin-panel").hidden = false;
      $("admin-login-form").hidden = true;
      $("admin-login-form").reset();
      $("admin-login-status").replaceChildren();
      state.applicants = rows;
      if (!rows.length) { message("applicants-status", "아직 접수된 지원서가 없습니다."); return; }
      $("applicants-status").replaceChildren(element("h3", `전체 지원서 목록 (총 ${rows.length}명)`));
      renderTable("applicants-table", rows.map(row => ({
        "지원서코드": row.id, "이름": row.name, "학번": row.student_id,
        "연락처": row.phone, "면접 가능 시간": slotsOf(row).join(", ") || "선택 안함",
        "지원 사유": row.motive, "접수 일시": formatDate(row.created_at)
      })));
      $("assign-interviews").disabled = false;
    } catch (error) {
      if (request !== state.listRequest) return;
      if (error.code === "42501") {
        lockAdmin();
        message("admin-login-status", "비밀번호가 올바르지 않습니다.", "error");
      } else {
        message(state.adminPassword ? "applicants-status" : "admin-login-status", "데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "error");
      }
    }
    finally { if (request === state.listRequest) $("refresh-applicants").disabled = false; }
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
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? "apply" : event.key === "End" ? "lookup" : name === "apply" ? "lookup" : "apply";
        showTab(next, true);
      }
    });
  }

  $("application-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!getApi() || $("application-fields").disabled) return;
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(["name", "student_id", "phone", "motive"].map(key => [key, String(data.get(key) || "").trim()]));
    values.slots = data.getAll("slots");
    if (Object.values(values).some(value => !value.length)) {
      message("submit-status", "모든 필드와 면접 가능 일정을 최소 1개 이상 선택해 주세요.", "warning");
      return;
    }
    $("application-fields").disabled = true;
    message("submit-status", "지원서를 제출하는 중입니다.");
    try {
      const code = await getApi().submit(values);
      message("submit-status", `성공적으로 접수되었습니다! 본인의 지원서 코드는 [${code}] 입니다.\n원할 경우 언제든지 지원서 코드를 이용해 본인의 지원서를 조회할 수 있습니다.`, "success");
      $("application-form").reset();
      refreshApplicants();
    } catch (error) {
      message("submit-status", error.code === "23505"
        ? "이미 해당 학번으로 신청한 내역이 존재합니다."
        : "데이터 저장 중 오류가 발생했습니다. 제출 내역을 확인하거나 운영진에게 문의해 주세요.", error.code === "23505" ? "warning" : "error");
    } finally { $("application-fields").disabled = false; }
  });

  $("lookup-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!getApi() || $("lookup-button").disabled) return;
    const code = $("application-code").value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) { message("lookup-result", "지원서 코드를 입력해 주세요.", "warning"); return; }
    $("lookup-button").disabled = true;
    message("lookup-result", "제출 내역을 확인하는 중입니다.");
    try {
      const row = await getApi().lookup(code);
      if (!row) { message("lookup-result", "일치하는 지원서 코드가 없습니다.", "error"); return; }
      message("lookup-result", `${row.name}님의 지원서는 다음과 같습니다.`, "success");
      for (const [label, value] of Object.entries({ "학번": row.student_id, "연락처": row.phone, "지원 사유": row.motive, "선택한 면접 일정": slotsOf(row).join(", ") || "없음", "접수 일시": formatDate(row.created_at) })) {
        const item = element("p", undefined, "detail-row");
        item.append(element("strong", label + ": "), document.createTextNode(String(value ?? "")));
        $("lookup-result").append(item);
      }
    } catch { message("lookup-result", "조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "error"); }
    finally { $("lookup-button").disabled = false; }
  });

  $("admin-login-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!getApi() || $("admin-login-button").disabled) return;
    const password = $("admin-password").value;
    $("admin-login-button").disabled = true;
    message("admin-login-status", "비밀번호를 확인하는 중입니다.");
    try { await refreshApplicants(password); }
    finally { $("admin-login-button").disabled = false; }
  });
  $("refresh-applicants").addEventListener("click", () => refreshApplicants());
  $("assign-interviews").addEventListener("click", () => {
    if (!state.adminPassword || !state.applicants.length) return;
    state.assignments = assignInterviews(state.applicants);
    renderTable("assignment-table", state.assignments);
    $("assignment-result").hidden = false;
  });
  $("download-csv").addEventListener("click", () => {
    if (!state.adminPassword || !state.assignments.length) return;
    const url = URL.createObjectURL(new Blob([csvString(state.assignments)], { type: "text/csv;charset=utf-8" }));
    const link = element("a");
    link.href = url;
    link.download = "면접배정결과.csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function renderSlots(content) {
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

  function connect() {
    for (const id of ["application-fields", "lookup-button", "refresh-applicants", "admin-login-button"]) $(id).disabled = !getApi();
  }
  return { refresh: refreshApplicants, renderSlots, connect };
}
