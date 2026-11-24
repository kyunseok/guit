import { $ } from "./ui.js";

export async function initializePwa() {
  let installPrompt = null;
  let waitingWorker = null;
  let updating = false;
  const installed = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const onlineStatus = () => { $("offline-status").hidden = navigator.onLine; };
  onlineStatus();
  window.addEventListener("online", onlineStatus);
  window.addEventListener("offline", onlineStatus);
  $("install-app").hidden = installed();
  $("install-help-close").addEventListener("click", () => $("install-help").close());
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    $("install-app").hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    $("install-app").hidden = true;
    $("install-help").close();
  });
  $("install-app").addEventListener("click", async () => {
    if (!installPrompt) { $("install-help").showModal(); return; }
    const prompt = installPrompt;
    installPrompt = null;
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { $("install-help").showModal(); }
  });
  if (!("serviceWorker" in navigator)) return;
  $("update-app").addEventListener("click", () => {
    if (!waitingWorker || updating) return;
    updating = true;
    $("update-app").disabled = true;
    waitingWorker.postMessage({ type: "ACTIVATE_UPDATE" });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updating) window.location.reload();
  });
  try {
    const registration = await navigator.serviceWorker.register(new URL("sw.js", document.baseURI), { scope: "./", updateViaCache: "none" });
    const showUpdate = () => {
      waitingWorker = registration.waiting;
      $("update-status").hidden = !waitingWorker || !navigator.serviceWorker.controller;
    };
    showUpdate();
    registration.addEventListener("updatefound", () => {
      registration.installing?.addEventListener("statechange", showUpdate);
    });
    let checkedAt = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && navigator.onLine && Date.now() - checkedAt > 3600000) {
        checkedAt = Date.now();
        void registration.update().catch(() => {});
      }
    });
  } catch {
    $("install-help-status").textContent = "오프라인 준비를 완료하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 접속해 주세요. 일반 웹사이트는 계속 이용할 수 있습니다.";
  }
}
