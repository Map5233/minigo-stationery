const menuButton = document.querySelector("[data-menu-toggle]");
const menu = document.querySelector("[data-menu]");
const menuLinks = menu ? [...menu.querySelectorAll("a")] : [];

const setMenu = (open) => {
  if (!menuButton || !menu) return;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  menu.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
};

function toggleMenu() {
  if (!menuButton) return;
  setMenu(menuButton.getAttribute("aria-expanded") !== "true");
}

menuLinks.forEach((link) => link.addEventListener("click", () => setMenu(false)));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu && menu.classList.contains("is-open")) {
    setMenu(false);
    if (menuButton) menuButton.focus();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 700 && menu) setMenu(false);
});

const year = document.querySelector("[data-year]");
if (year) year.textContent = new Date().getFullYear();

const sectionLinks = [...document.querySelectorAll("[data-section-link]")];
const navSections = [...document.querySelectorAll("[data-nav-section]")];

const updateCurrentSection = () => {
  if (!sectionLinks.length || !navSections.length) return;

  const marker = window.scrollY + Math.min(window.innerHeight * 0.35, 320);
  let activeId = "";

  navSections.forEach((section) => {
    if (section.offsetTop <= marker) activeId = section.id;
  });

  sectionLinks.forEach((link) => {
    const isCurrent = activeId && link.hash === `#${activeId}`;
    if (isCurrent) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
};

if (sectionLinks.length && navSections.length) {
  window.addEventListener("scroll", updateCurrentSection, { passive: true });
  window.addEventListener("resize", updateCurrentSection, { passive: true });
  updateCurrentSection();
}

const scrubScene = document.querySelector("[data-hero-scrub-scene]");
const scrubVideo = document.querySelector("[data-hero-scrub]");

if (scrubScene && scrubVideo) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileViewport = window.matchMedia("(max-width: 700px)");
  let scrubDuration = 6;
  let scrubTimer = 0;

  const updateScrubFrame = () => {
    scrubTimer = 0;
    if (reducedMotion.matches || !scrubVideo.duration) return;

    const sceneRect = scrubScene.getBoundingClientRect();
    const scrollRange = Math.max(scrubScene.offsetHeight - window.innerHeight, 1);
    const progress = Math.min(Math.max(-sceneRect.top / scrollRange, 0), 1);
    const nextTime = progress * Math.max(scrubDuration - 1 / 24, 0);

    if (Math.abs(scrubVideo.currentTime - nextTime) > 1 / 48) {
      scrubVideo.currentTime = nextTime;
    }
  };

  const requestScrubFrame = () => {
    if (scrubTimer || reducedMotion.matches) return;
    scrubTimer = window.setTimeout(updateScrubFrame, 16);
  };

  const setHeroMedia = () => {
    const mobile = mobileViewport.matches;
    const poster = mobile
      ? scrubVideo.dataset.mobilePoster
      : scrubVideo.dataset.desktopPoster;
    const source = mobile
      ? scrubVideo.dataset.mobileSrc
      : scrubVideo.dataset.desktopSrc;

    scrubVideo.poster = poster;

    if (reducedMotion.matches) {
      scrubVideo.pause();
      scrubVideo.removeAttribute("src");
      scrubVideo.load();
      return;
    }

    if (scrubVideo.dataset.activeSrc === source) {
      requestScrubFrame();
      return;
    }

    scrubVideo.dataset.activeSrc = source;
    scrubVideo.addEventListener(
      "loadedmetadata",
      () => {
        scrubDuration = Number.isFinite(scrubVideo.duration)
          ? scrubVideo.duration
          : 6;
        scrubVideo.pause();
        requestScrubFrame();
      },
      { once: true },
    );
    scrubVideo.src = source;
    scrubVideo.load();
  };

  window.addEventListener("scroll", requestScrubFrame, { passive: true });
  window.addEventListener("resize", requestScrubFrame, { passive: true });
  mobileViewport.addEventListener("change", setHeroMedia);
  reducedMotion.addEventListener("change", setHeroMedia);
  setHeroMedia();
}

const storyList = document.querySelector("[data-story-list]");

const formatStoryDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const storyHref = (post) =>
  post.url
    ? `story/${String(post.url).replace(/^\.\//, "")}`
    : `story/post.html?id=${encodeURIComponent(post.id || "")}`;

const renderHomeStories = (posts) => {
  storyList.textContent = "";
  const latest = Array.isArray(posts)
    ? posts
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .slice(0, 3)
    : [];

  if (!latest.length) {
    const empty = document.createElement("p");
    empty.className = "home-story-message";
    empty.textContent = "첫 번째 이야기를 준비하고 있습니다.";
    storyList.appendChild(empty);
    return;
  }

  latest.forEach((post) => {
    const article = document.createElement("article");
    article.className = "story-item";
    const link = document.createElement("a");
    link.href = storyHref(post);

    const time = document.createElement("time");
    time.dateTime = String(post.date || "");
    time.textContent = formatStoryDate(post.date);

    const title = document.createElement("h3");
    title.textContent = String(post.title || "(제목 없음)");

    const summary = document.createElement("p");
    summary.textContent = String(post.summary || "이야기의 자세한 내용을 확인해 보세요.");

    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";

    link.append(time, title, summary, arrow);
    article.appendChild(link);
    storyList.appendChild(article);
  });
};

if (storyList) {
  fetch("story/posts.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(renderHomeStories)
    .catch(() => {
      if (!storyList.children.length) {
        const error = document.createElement("p");
        error.className = "home-story-message";
        error.textContent = "이야기를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
        storyList.appendChild(error);
      }
    });
}
