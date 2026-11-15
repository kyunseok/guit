export function initializeHomeVideo() {
  const videoId = "39Ikw6nTnJE";
  const toggle = document.getElementById("home-video-toggle");
  const status = document.getElementById("home-video-status");
  const backdrop = document.querySelector(".home-video-backdrop");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let active = false;
  let paused = motion.matches || Boolean(navigator.connection?.saveData);
  let player;
  let ready = false;
  let started = false;
  let failed = false;
  let hasPlayed = false;
  let timer;

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function armTimeout() {
    if (!timer && !hasPlayed) timer = setTimeout(fail, 20000);
  }

  function updateButton() {
    toggle.disabled = started && !ready && !failed;
    toggle.textContent = failed ? "영상 재생 불가" : toggle.disabled ? "영상 불러오는 중" : paused ? "영상 재생" : "영상 일시정지";
    if (failed) toggle.disabled = true;
  }

  function fail() {
    clearTimer();
    failed = true;
    paused = true;
    player?.destroy();
    backdrop.classList.remove("video-ready");
    status.textContent = "영상을 불러오지 못했습니다. YouTube에서 확인해 주세요.";
    updateButton();
  }

  function sync() {
    if (!ready || failed) return;
    if (active && !document.hidden && !paused) {
      player.mute();
      player.playVideo();
      armTimeout();
    } else {
      clearTimer();
      player.pauseVideo();
    }
  }

  function createPlayer() {
    if (player || failed || !active || document.hidden) return;
    player = new window.YT.Player("home-video-player", {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 0, controls: 0, playsinline: 1, loop: 1, playlist: videoId, rel: 0, fs: 0, disablekb: 1, origin: location.origin },
      events: {
        onReady(event) {
          clearTimer();
          if (failed) return;
          player = event.target;
          ready = true;
          player.mute();
          updateButton();
          sync();
        },
        onStateChange(event) {
          if (event.data === 1) {
            if (!active || document.hidden || paused) { player.pauseVideo(); return; }
            hasPlayed = true;
            clearTimer();
            backdrop.classList.add("video-ready");
            status.textContent = "";
          }
        },
        onAutoplayBlocked() {
          clearTimer();
          paused = true;
          status.textContent = "영상 재생을 누르면 음소거로 재생됩니다.";
          updateButton();
        },
        onError: fail
      }
    });
    const iframe = player.getIframe();
    iframe.title = "기타하나 배경 영상";
    iframe.tabIndex = -1;
    iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
  }

  function start() {
    if (!active || document.hidden || paused || failed) return;
    if (started) {
      if (!ready) armTimeout();
      if (window.YT?.Player) createPlayer();
      sync();
      return;
    }
    started = true;
    updateButton();
    armTimeout();
    if (window.YT?.Player) { createPlayer(); return; }
    window.onYouTubeIframeAPIReady = createPlayer;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    status.textContent = "";
    updateButton();
    start();
    sync();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimer(); start(); sync(); });
  motion.addEventListener("change", event => {
    if (event.matches) { paused = true; updateButton(); sync(); }
  });

  updateButton();
  return visible => {
    active = visible;
    if (!visible) clearTimer();
    if (visible) backdrop.style.backgroundImage = `url("https://i.ytimg.com/vi/${videoId}/hqdefault.jpg")`;
    start();
    sync();
  };
}
