import { $, element } from "./ui.js";
import { renderSetlist } from "./setlist-view.js";
import { fetchSetlist } from "./setlists.js";

export function initializePerformances(openFeedback, getApi = () => null) {
  const performanceState = new Map();
  let activePerformance = "";
  let navigationRequest = 0;

  function renderPerformances(performances) {
    $("performance-select").addEventListener("change", event => { location.hash = "performances/" + event.target.value; });
    for (const performance of performances) {
      if (!/^[a-z-]+$/.test(performance.id)) continue;
      const link = element("a", performance.title);
      link.href = "#performances/" + performance.id;
      link.dataset.performance = performance.id;
      $("performance-nav").append(link);
      const option = element("option", performance.title);
      option.value = performance.id;
      $("performance-select").append(option);
      const panel = element("section", undefined, "performance-panel");
      panel.id = "performance-" + performance.id;
      panel.hidden = true;
      const title = element("h2", performance.title);
      title.id = panel.id + "-title";
      panel.setAttribute("aria-labelledby", title.id);
      const heading = element("div", undefined, "performance-heading");
      heading.append(title);
      panel.append(heading);
      const sheets = performance.sheets?.length
        ? performance.sheets.filter(sheet => /^[a-z0-9-]+$/.test(sheet.id))
        : [{ id: "default", title: performance.title, sheetUrl: performance.sheetUrl, headerRow: performance.headerRow, songColumn: performance.songColumn }];
      const source = element("a", "원본 스프레드시트 열기", "setlist-source");
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.hidden = true;
      heading.append(source);
      const sheetNav = element("nav", undefined, "sheet-tabs");
      sheetNav.setAttribute("aria-label", performance.title + " 시트 선택");
      const status = element("div");
      status.setAttribute("role", "status");
      const data = element("div");
      panel.append(sheetNav, status, data);
      $("performance-panels").append(panel);
      performanceState.set(performance.id, { ...performance, panel, source, sheetNav, sheets, configuredSheets: sheets, documentUrl: performance.sheetUrl || sheets[0]?.sheetUrl, status, data, selectedSheet: "", loadedAt: 0, request: 0 });
    }
  }

  function renderSheetTabs(item) {
    item.sheetNav.replaceChildren();
    item.sheetNav.hidden = item.sheets.length < 2;
    for (const sheet of item.sheets) {
      const tab = element("a", sheet.title);
      tab.href = "#performances/" + item.id + "/" + sheet.id;
      tab.dataset.sheet = sheet.id;
      item.sheetNav.append(tab);
    }
  }

  async function discoverSheets(item) {
    const api = getApi();
    if (!api || !item.documentUrl) return;
    const documentId = new URL(item.documentUrl).pathname.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1];
    try {
      const discovered = await api.sheetsList(documentId);
      item.sheets = discovered.map(sheet => {
        const configured = item.configuredSheets.find(entry => {
          const url = new URL(entry.sheetUrl);
          return (url.searchParams.get("gid") || new URLSearchParams(url.hash.slice(1)).get("gid") || "0") === sheet.gid;
        });
        return { ...configured, id: configured?.id || "gid-" + sheet.gid, title: sheet.title, sheetUrl: "https://docs.google.com/spreadsheets/d/" + documentId + "/edit?gid=" + sheet.gid };
      });
      item.catalogWarning = "";
    } catch {
      item.catalogWarning = "시트 목록을 갱신하지 못해 이전 목록을 표시합니다. 공연 탭을 다시 열어 주세요.";
    }
  }

  async function showPerformance(requested, entering = false, requestedSheet) {
    const navigation = ++navigationRequest;
    const id = performanceState.has(requested) ? requested : performanceState.keys().next().value;
    for (const [key, item] of performanceState) item.panel.hidden = key !== id;
    for (const link of $("performance-nav").querySelectorAll("a")) {
      if (link.dataset.performance === id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    const item = performanceState.get(id);
    if (!item) return;
    $("performance-select").value = id;
    item.requestedSheet = requestedSheet;
    const changedPerformance = activePerformance !== id;
    activePerformance = id;
    if (entering || changedPerformance || !item.sheetsChecked) {
      item.status.replaceChildren(element("p", "시트 목록을 불러오는 중입니다.", "muted"));
      await discoverSheets(item);
      item.sheetsChecked = true;
      if (navigation !== navigationRequest) return;
    }
    renderSheetTabs(item);
    const sheet = item.sheets.find(sheet => sheet.id === requestedSheet) || item.sheets[0];
    if (!sheet) return;
    const changedSheet = item.selectedSheet !== sheet.id;
    if (changedSheet) {
      item.request++;
      item.loadedAt = 0;
      item.data.replaceChildren();
      item.status.replaceChildren();
      item.selectedSheet = sheet.id;
      item.sheetUrl = sheet.sheetUrl;
      item.songColumn = sheet.songColumn;
      item.feedbackSheetUrl = sheet.feedbackSheetUrl || sheet.sheetUrl;
      item.feedbackTitle = item.sheets.length > 1 ? item.title + " · " + sheet.title : item.title;
    }
    item.source.hidden = !item.sheetUrl;
    if (item.sheetUrl) item.source.href = item.sheetUrl;
    else item.status.replaceChildren(element("p", "셋리스트가 아직 등록되지 않았습니다.", "notice"));
    for (const tab of item.sheetNav.querySelectorAll("a")) {
      if (tab.dataset.sheet === sheet.id) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    }
    if (item.sheetUrl && (entering || changedPerformance || changedSheet || !item.loadedAt)) await loadSetlist(id);
  }

  function sheetHeader(item) {
    return item.sheets.find(sheet => sheet.id === item.selectedSheet)?.headerRow;
  }

  async function loadSetlist(id) {
    const item = performanceState.get(id);
    if (!item?.sheetUrl) return;
    const request = ++item.request;
    item.status.replaceChildren(element("p", "셋리스트를 불러오는 중입니다.", "muted"));
    try {
      const result = await fetchSetlist(item.sheetUrl, sheetHeader(item));
      if (request !== item.request) return;
      const rendered = renderSetlist(result, { songColumn: item.songColumn ?? result.songColumn ?? 1, feedbackTitle: item.feedbackTitle, sheetUrl: item.feedbackSheetUrl }, openFeedback);
      item.data.replaceChildren(rendered.root);
      item.loadedAt = Date.now();
      item.status.replaceChildren();
      if (item.catalogWarning) item.status.append(element("p", item.catalogWarning, "notice warning"));
      if (!rendered.count) item.status.append(element("p", "아직 입력된 셋리스트가 없습니다.", "muted"));
    } catch {
      if (request !== item.request) return;
      item.status.replaceChildren(element("p", item.loadedAt
        ? "최신 내용을 불러오지 못해 이전 목록을 표시합니다. 탭을 다시 열거나 원본 스프레드시트를 확인해 주세요."
        : "셋리스트를 불러오지 못했습니다. 탭을 다시 열거나 원본 스프레드시트를 확인해 주세요.", "notice error"));
    }
  }

  return { render: renderPerformances, show: showPerformance, connect: () => { if (activePerformance) void showPerformance(activePerformance, true, performanceState.get(activePerformance)?.requestedSheet); } };
}
