/* ==========================================================================
   Light / dark theme
   Loaded in <head> (not deferred) so the right theme is set before the page
   paints, with no white flash. Uses the visitor's saved choice if there is
   one, otherwise their system setting. The button with data-theme-toggle
   switches it and remembers the choice in localStorage.
   ========================================================================== */

(function () {
  const root = document.documentElement;

  function savedTheme() {
    try { return localStorage.getItem("theme"); } catch (e) { return null; }
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = savedTheme() || (prefersDark ? "dark" : "light");
  root.classList.toggle("dark", theme === "dark");

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector("[data-theme-toggle]");
    if (!button) return;
    button.addEventListener("click", () => {
      const dark = root.classList.toggle("dark");
      try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) { /* storage blocked */ }
    });
  });
})();
