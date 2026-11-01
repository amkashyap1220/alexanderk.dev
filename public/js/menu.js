/* ==========================================================================
   The ☰ menu on phones: the button opens the nav inside the header.
   Loaded in <head> so the .js class is set before the page paints; without
   it (no scripts) the phone header keeps its tabs in a row instead.
   Closes on Escape, a tap outside the header, or choosing a link.
   ========================================================================== */

document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector("[data-menu-toggle]");
  const header = document.querySelector(".site-header");
  if (!button || !header) return;
  const isOpen = () => header.classList.contains("menu-open");
  const set = (open) => {
    header.classList.toggle("menu-open", open);
    button.setAttribute("aria-expanded", String(open));
  };
  button.addEventListener("click", () => set(!isOpen()));
  header.querySelectorAll(".site-nav a").forEach((link) => link.addEventListener("click", () => set(false)));
  document.addEventListener("click", (event) => { if (isOpen() && !header.contains(event.target)) set(false); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) { set(false); button.focus(); }
  });
});
