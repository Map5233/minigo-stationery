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
  if (event.key === "Escape" && menu.classList.contains("is-open")) {
    setMenu(false);
    menuButton.focus();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 700 && menu) setMenu(false);
});

const year = document.querySelector("[data-year]");
if (year) year.textContent = new Date().getFullYear();

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
      storyList.textContent = "";
      const error = document.createElement("p");
      error.className = "home-story-message";
      error.textContent = "이야기를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
      storyList.appendChild(error);
    });
}
