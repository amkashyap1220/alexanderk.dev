/* ==========================================================================
   Light / dark theme
   Loaded in <head> (not deferred) so the right theme is set before the page
   paints, with no flash. Uses the visitor's saved choice if there is one,
   otherwise their system setting, and always puts .light or .dark on <html>.
   (With JavaScript off, css/style.css falls back to the system setting.)
   The button with data-theme-toggle switches it and remembers the choice.
   ========================================================================== */

(function () {
  const root = document.documentElement;

  function savedTheme() {
    try { return localStorage.getItem("theme"); } catch (e) { return null; }
  }

  function apply(theme) {
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme !== "dark");
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  apply(savedTheme() || (prefersDark ? "dark" : "light"));

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector("[data-theme-toggle]");
    if (!button) return;
    // aria-pressed tells screen readers whether dark mode is on
    const sync = () => button.setAttribute("aria-pressed", String(root.classList.contains("dark")));
    sync();
    button.addEventListener("click", () => {
      const theme = root.classList.contains("dark") ? "light" : "dark";
      apply(theme);
      sync();
      try { localStorage.setItem("theme", theme); } catch (e) { /* storage blocked */ }
    });
  });
})();
