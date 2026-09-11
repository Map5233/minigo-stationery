(function () {
  "use strict";
  if (window.__minigoRequestsStarted) return;
  window.__minigoRequestsStarted = true;
  const policy = window.MinigoPublishPolicy;
  const panels = [];
  let manifest, controller, generation = 0, lastAttempt = 0;
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  async function json(url, signal) {
    const response = await fetch(url, { signal, cache: "no-store", credentials: "omit", headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? "rate" : "network");
    return response.json();
  }
  function makePanel(post, parent) {
    const section = node("section", "", "publish-request");
    section.dataset.pr = String(post.pr);
    section.setAttribute("aria-label", post.title + " 발행 요청");
    const label = node("p", "글을 확인하셨나요?", "publish-request__label");
    const status = node("p", "GitHub에서 글 버전과 요청 상태를 확인하고 있습니다.", "publish-request__status");
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const actions = node("div", "", "publish-request__actions");
    const action = node("a", "발행 요청", "publish-request__action");
    action.setAttribute("aria-disabled", "true");
    action.setAttribute("role", "link");
    const retry = node("button", "상태 확인", "publish-request__retry");
    retry.type = "button"; retry.addEventListener("click", () => refresh());
    const help = node("p", "GitHub의 Map5233 계정으로 제출해 주세요. 비밀번호는 GitHub에서만 입력합니다.", "publish-request__help");
    const detail = node("a", "요청·취소 방법", "publish-request__help-link"); detail.href = "/review/request-help.html";
    actions.append(action, retry); section.append(label, status, actions, help, detail); parent.append(section);
    action.addEventListener("click", event => {
      if (action.getAttribute("aria-disabled") === "true") { event.preventDefault(); return; }
      if (action.dataset.intent === "create") {
        // Navigation is not submission. GitHub owns sign-in and final confirmation.
        status.textContent = "GitHub에서 최종 제출해야 저장됩니다. 돌아온 뒤 ‘상태 확인’을 눌러 주세요.";
      }
    });
    panels.push({ post, section, status, action, retry });
  }
  function setAction(panel, text, href, intent) {
    panel.action.textContent = text;
    panel.action.dataset.intent = intent || "";
    if (href) { panel.action.href = href; panel.action.removeAttribute("aria-disabled"); panel.action.rel = "noopener"; }
    else { panel.action.removeAttribute("href"); panel.action.setAttribute("aria-disabled", "true"); }
  }
  function show(panel, pull, issues) {
    const state = policy.pullState(panel.post, pull);
    const messages = { stale: "글이 수정되어 지금 읽은 버전과 다릅니다. 검토함이 갱신된 뒤 다시 읽어 주세요.",
      closed: "이 글의 검토가 종료되어 새 발행 요청을 받지 않습니다.",
      merged: "이 글은 이미 병합되었습니다. 실제 발행 여부는 배포 상태를 확인해야 합니다.",
      draft: "아직 작성 중인 글입니다. 검토 준비가 끝난 뒤 요청해 주세요.",
      invalid: "글 정보를 확인할 수 없습니다. 검토함 갱신이 필요합니다." };
    if (state !== "ready") { panel.status.textContent = messages[state]; setAction(panel, "요청 불가"); return; }
    const stored = policy.storedRequest(issues, panel.post, pull);
    if (stored) {
      panel.status.textContent = "본인 계정의 요청이 GitHub에 저장됐습니다. 아직 발행 완료 상태는 아닙니다.";
      setAction(panel, "저장된 요청 보기", "https://github.com/" + policy.repo + "/issues/" + stored.number, "view");
    } else {
      panel.status.textContent = "요청할 수 있습니다. 다음 GitHub 화면에서 ‘Submit new issue’를 눌러야 요청이 저장됩니다.";
      setAction(panel, "발행 요청", policy.issueURL(panel.post), "create");
    }
  }
  async function listIssues(signal) {
    const all = [];
    for (let page=1; page<=10; page++) {
      const batch = await json("https://api.github.com/repos/" + policy.repo + "/issues?creator=" + policy.owner.login + "&state=all&per_page=100&page=" + page, signal);
      if (!Array.isArray(batch)) throw new Error("network");
      all.push(...batch);
      if (batch.length < 100) return all;
    }
    throw new Error("too-many");
  }
  async function refresh() {
    if (!panels.length) return;
    const run = ++generation;
    controller?.abort(); controller = new AbortController(); const signal = controller.signal;
    lastAttempt = Date.now();
    const timer = setTimeout(() => controller?.signal === signal && controller.abort(), 12000);
    panels.forEach(panel => {
      panel.section.setAttribute("aria-busy", "true"); panel.retry.disabled = true;
      panel.status.textContent = "GitHub에서 글 버전과 요청 상태를 확인하고 있습니다.";
      setAction(panel, "발행 요청");
    });
    try {
      const unique = [...new Set(panels.map(p=>p.post.pr))];
      const [issues, pulls] = await Promise.all([listIssues(signal), Promise.all(unique.map(id => json("https://api.github.com/repos/" + policy.repo + "/pulls/" + id, signal)))]);
      if (run !== generation) return;
      panels.forEach(panel=>show(panel,pulls.find(p=>p.number===panel.post.pr),issues));
    } catch (error) {
      if (run !== generation) return;
      panels.forEach(panel => {
        panel.status.textContent = navigator.onLine === false ? "인터넷 연결을 확인한 뒤 ‘상태 확인’을 눌러 주세요." :
          error.message === "rate" ? "GitHub의 조회 한도에 도달했습니다. 잠시 후 ‘상태 확인’을 눌러 주세요." :
          "요청 상태를 불러오지 못했습니다. ‘상태 확인’으로 다시 시도해 주세요.";
        setAction(panel, "확인 후 요청");
      });
    } finally {
      clearTimeout(timer);
      if (run === generation) panels.forEach(panel => { panel.retry.disabled = false; panel.section.removeAttribute("aria-busy"); });
    }
  }
  async function init() {
    const intro = document.querySelector("[data-request-init]");
    try {
      const startup = new AbortController(), timer = setTimeout(()=>startup.abort(),12000);
      try { manifest = await json("/review/posts.json", startup.signal); } finally { clearTimeout(timer); }
      if (!policy || !Array.isArray(manifest.posts) || manifest.posts.some(p=>!policy.validPost(p))) throw new Error("manifest");
      const current = location.pathname.split("/").pop();
      manifest.posts.forEach(post => {
        const article = document.querySelector(".post-article");
        if (article && current === post.url) makePanel(post,article);
        else if (!article) {
          const link = [...document.querySelectorAll("a.read")].find(a=>new URL(a.href).pathname.endsWith("/"+post.url));
          if (link?.closest("li")) makePanel(post,link.closest("li"));
        }
      });
      if (intro) intro.textContent = panels.length ? "글을 읽은 뒤 ‘발행 요청’을 누르세요. 요청은 GitHub에 공개 기록되며, 바로 발행되지는 않습니다." : "현재 발행 요청할 글이 없습니다.";
      await refresh();
    } catch (_) {
      if (intro) { intro.textContent = "발행 요청 기능을 불러오지 못했습니다. 페이지를 새로고침해 주세요."; }
      else if (document.querySelector(".post-article")) {
        const error = node("p","발행 요청 기능을 불러오지 못했습니다. 검토함에서 다시 시도해 주세요.","publish-request");
        document.querySelector(".post-article").append(error);
      }
    }
  }
  window.addEventListener("pageshow",()=>{ if (Date.now()-lastAttempt>30000 || panels.some(p=>p.section.hasAttribute("aria-busy"))) refresh(); });
  window.addEventListener("online",()=>refresh());
  window.addEventListener("pagehide",()=>{ generation++; controller?.abort(); });
  init();
})();
