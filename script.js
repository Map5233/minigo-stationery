const menuButton = document.querySelector("[data-menu-toggle]");
const menu = document.querySelector("[data-menu]");
const menuLinks = [...menu.querySelectorAll("a")];

const setMenu = (open) => {
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  menu.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
};

function toggleMenu() {
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
  if (window.innerWidth > 700) setMenu(false);
});

document.querySelector("[data-year]").textContent = new Date().getFullYear();
