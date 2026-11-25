import { $, element, message } from "./ui.js";
import { jsonFile, publicFileUrl } from "./files.js";
import { slidesPdfUrl } from "./materials.js";

export async function loadMaterials() {
  try {
    const files = await jsonFile("data/materials.json");
    if (!files.length) { message("materials-list", "아직 등록된 정모 자료가 없습니다."); return; }
    $("materials-list").replaceChildren();
    for (const [index, file] of files.entries()) {
      const card = element("article", undefined, "material-card");
      card.append(element("p", file.title, "material-title"));
      if (file.url) {
        const online = element("a", "링크");
        const url = new URL(file.url);
        if (url.protocol !== "https:") throw new Error("LINK");
        online.href = url.href;
        online.target = "_blank";
        online.rel = "noopener noreferrer";
        const paragraph = element("p", undefined, "material-online");
        paragraph.append(online);
        card.append(paragraph);
      }
      if (!file.path) {
        const exportUrl = slidesPdfUrl(file.url);
        if (exportUrl) {
          const download = element("a", "PDF 다운로드", "download-link");
          download.href = exportUrl;
          download.target = "_blank";
          download.rel = "noopener noreferrer";
          download.setAttribute("aria-label", file.title + " PDF 다운로드 (Google Slides)");
          card.append(download);
        }
        $("materials-list").append(card);
        continue;
      }
      const link = element("a", "PDF 다운로드", "download-link");
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
        const expanded = toggle.getAttribute("aria-expanded") !== "true";
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
        preview.hidden = !expanded;
        preview.inert = !expanded;
      });
      actions.append(toggle, link);
      card.append(element("p", `PDF · ${(file.size / 1048576).toFixed(2)} MB`, "material-meta"), actions, preview);
      $("materials-list").append(card);
    }
  } catch { message("materials-list", "자료를 불러올 수 없습니다. 잠시 후 다시 확인해 주세요.", "error"); }
}

function renderGuitarClasses(groups) {
  const cards = element("div", undefined, "guitar-class-grid");
  for (const group of groups) {
    const card = element("article", undefined, "guitar-class-card");
    const heading = element("h4", group.name);
    heading.id = "guitar-class-group-" + group.id;
    card.setAttribute("aria-labelledby", heading.id);
    const header = element("div", undefined, "guitar-class-card-header");
    header.append(heading);
    card.append(header);
    if (group.missions.length) {
      const missions = element("ul", undefined, "mission-list");
      for (const mission of group.missions) missions.append(element("li", mission));
      card.append(missions);
    } else {
      card.append(element("p", "올클", "mission-complete"));
    }
    cards.append(card);
  }

  const weeks = element("ul", undefined, "schedule-list");
  weeks.setAttribute("aria-label", "기타교실 청소 일정");
  for (let week = 1; week <= 16; week++) {
    const assigned = groups.filter(group => group.cleaningWeek === week);
    if (!assigned.length) continue;
    const item = element("li");
    item.append(
      element("strong", `${week}주차:`),
      document.createTextNode(" " + assigned.map(group => "기타교실 " + group.name).join(", "))
    );
    weeks.append(item);
  }
  $("guitar-class-content").replaceChildren(
    element("h3", "기타교실 별 남은 미션"), cards, element("hr"),
    element("h3", "주차별 청소 일정"), weeks
  );
}

export function renderContent(content) {
  $("introduction").textContent = content.introduction;
  for (const item of content.schedule) {
    const li = element("li");
    li.append(element("strong", item.week + ":"), document.createTextNode(" " + item.text));
    $("schedule-list").append(li);
  }
  if (Array.isArray(content.guitarClasses) && content.guitarClasses.length) renderGuitarClasses(content.guitarClasses);
  else message("guitar-class-content", "아직 등록된 기타교실 정보가 없습니다.");
}
