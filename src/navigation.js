import { $, element } from "./ui.js";

export function initializeNavigation({ reservations, performances }) {
  let activeView = "";
  const mainNav = document.querySelector(".main-nav");

  function updateNavIndicator() {
    const active = mainNav.querySelector('[aria-current="page"]');
    if (!active) return;
    const style = getComputedStyle(active);
    const left = parseFloat(style.paddingLeft);
    const right = parseFloat(style.paddingRight);
    mainNav.style.setProperty("--nav-line-x", active.offsetLeft + left + "px");
    mainNav.style.setProperty("--nav-line-y", active.offsetTop + active.offsetHeight - 6 + "px");
    mainNav.style.setProperty("--nav-line-width", Math.max(0, active.offsetWidth - left - right) + "px");
    if (!mainNav.classList.contains("indicator-ready")) {
      mainNav.classList.add("indicator-ready");
      requestAnimationFrame(() => requestAnimationFrame(() => mainNav.classList.add("indicator-animated")));
    }
  }

  const navResizeObserver = new ResizeObserver(updateNavIndicator);
  navResizeObserver.observe(mainNav);
  for (const link of mainNav.querySelectorAll("a")) navResizeObserver.observe(link);
  document.fonts.ready.then(updateNavIndicator);

  function showView(moveFocus = false) {
    const [requested, performance, sheet] = location.hash.slice(1).split("/");
    const view = ["about", "schedule", "room-reservation", "guitar-class", "performances"].includes(requested) ? requested : "about";
    for (const section of document.querySelectorAll(".view")) section.hidden = section.id !== view;
    for (const link of document.querySelectorAll("[data-view]")) {
      if (link.dataset.view === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    updateNavIndicator();
    if (moveFocus) $("main").focus({ preventScroll: true });
    const hasTabs = view !== "about";
    $("main").classList.toggle("with-tabs", hasTabs);
    $("side-tabs").hidden = !hasTabs;
    $("reservation-nav").hidden = view !== "room-reservation";
    $("performance-navigation").hidden = view !== "performances";
    $("semester-nav").hidden = !["schedule", "guitar-class"].includes(view);
    if (view === "schedule" || view === "guitar-class") showSemester(view, performance);
    if (view === "performances") performances.show(performance, activeView !== view, sheet);
    reservations.show(view === "room-reservation", performance);
    activeView = view;
  }

  function showSemester(view, requested) {
    const semester = requested === "27-1" ? "27-1" : "26-2";
    $("semester-nav").replaceChildren();
    for (const term of ["26-2", "27-1"]) {
      const link = element("a", term + "학기");
      link.href = "#" + view + "/" + term;
      if (term === semester) link.setAttribute("aria-current", "page");
      $("semester-nav").append(link);
      $(view + "-" + term).hidden = term !== semester;
    }
  }

  window.addEventListener("hashchange", () => showView(true));
  return { show: showView };
}
