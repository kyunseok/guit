import { $, element } from "./ui.js";
import { renderSetlist } from "./setlist-view.js";
import { fetchSetlist } from "./setlists.js";

export function initializePerformances(openFeedback) {
  const performanceState = new Map();
  let activePerformance = "";

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
        ? performance.sheets.filter(sheet => /^[a-z-]+$/.test(sheet.id))
        : [{ id: "default", title: performance.title, sheetUrl: performance.sheetUrl, headerRow: performance.headerRow, songColumn: performance.songColumn }];
      const source = element("a", "원본 스프레드시트 열기", "setlist-source");
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.hidden = true;
      heading.append(source);
      const sheetNav = element("nav", undefined, "sheet-tabs");
      sheetNav.setAttribute("aria-label", performance.title + " 시트 선택");
      sheetNav.hidden = sheets.length < 2;
      for (const sheet of sheets) {
        const tab = element("a", sheet.title);
        tab.href = "#performances/" + performance.id + "/" + sheet.id;
        tab.dataset.sheet = sheet.id;
        sheetNav.append(tab);
      }
      const status = element("div");
      status.setAttribute("role", "status");
      const data = element("div");
      panel.append(sheetNav, status, data);
      $("performance-panels").append(panel);
      performanceState.set(performance.id, { ...performance, panel, source, sheetNav, sheets, status, data, selectedSheet: "", loadedAt: 0, request: 0 });
    }
  }

  function showPerformance(requested, entering = false, requestedSheet) {
    const id = performanceState.has(requested) ? requested : performanceState.keys().next().value;
    for (const [key, item] of performanceState) item.panel.hidden = key !== id;
    for (const link of $("performance-nav").querySelectorAll("a")) {
      if (link.dataset.performance === id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    const item = performanceState.get(id);
    if (!item) return;
    $("performance-select").value = id;
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
      item.headerRow = sheet.headerRow ?? 1;
      item.songColumn = sheet.songColumn ?? 1;
      item.feedbackTitle = item.sheets.length > 1 ? item.title + " · " + sheet.title : item.title;
    }
    item.source.hidden = !item.sheetUrl;
    if (item.sheetUrl) item.source.href = item.sheetUrl;
    else item.status.replaceChildren(element("p", "셋리스트가 아직 등록되지 않았습니다.", "notice"));
    for (const tab of item.sheetNav.querySelectorAll("a")) {
      if (tab.dataset.sheet === sheet.id) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    }
    if (item.sheetUrl && (entering || activePerformance !== id || changedSheet || !item.loadedAt)) loadSetlist(id);
    activePerformance = id;
  }

  async function loadSetlist(id) {
    const item = performanceState.get(id);
    if (!item?.sheetUrl) return;
    const request = ++item.request;
    item.status.replaceChildren(element("p", "셋리스트를 불러오는 중입니다.", "muted"));
    try {
      const result = await fetchSetlist(item.sheetUrl, item.headerRow ?? 1);
      if (request !== item.request) return;
      const rendered = renderSetlist(result, { songColumn: item.songColumn ?? 1, feedbackTitle: item.feedbackTitle, sheetUrl: item.sheetUrl }, openFeedback);
      item.data.replaceChildren(rendered.root);
      item.loadedAt = Date.now();
      item.status.replaceChildren();
      if (!rendered.count) item.status.append(element("p", "아직 입력된 셋리스트가 없습니다.", "muted"));
    } catch {
      if (request !== item.request) return;
      item.status.replaceChildren(element("p", item.loadedAt
        ? "최신 내용을 불러오지 못해 이전 목록을 표시합니다. 탭을 다시 열거나 원본 스프레드시트를 확인해 주세요."
        : "셋리스트를 불러오지 못했습니다. 탭을 다시 열거나 원본 스프레드시트를 확인해 주세요.", "notice error"));
    }
  }

  return { render: renderPerformances, show: showPerformance };
}
