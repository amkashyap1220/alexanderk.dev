/* ==========================================================================
   Light / dark theme
   Loaded in <head> (not deferred) so the right theme is set before the page
   paints, with no flash. The site follows the visitor's system setting
   (light or dark) and changes with it, unless they've used the toggle to
   pick the other one: then their choice is remembered and wins. Toggling
   back to what the device uses forgets the choice, so the site follows the
   device again. (The choice used to be kept under "theme", even when it
   matched the device, which pinned some visitors to one mode; that old
   value is dropped so everyone starts from their device setting.) Always puts .light or .dark on
   <html>, and matches the phone browser's bar color (theme-color) and the
   browser tab icon (favicon.svg / favicon-dark.svg).
   The button with data-theme-toggle switches it and remembers the choice.
   ========================================================================== */

(function () {
  const root = document.documentElement;

  const KEY = "theme-choice";
  function savedTheme() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(theme) {
    try {
      if (theme) localStorage.setItem(KEY, theme);
      else localStorage.removeItem(KEY);
    } catch (e) { /* storage blocked */ }
  }
  try { localStorage.removeItem("theme"); } catch (e) { /* storage blocked */ }

  function apply(theme) {
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme !== "dark");
    const bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.content = theme === "dark" ? "#101214" : "#eceff1";
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = theme === "dark" ? "/favicon-dark.svg" : "/favicon.svg";
  }

  const system = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const systemTheme = () => (system && system.matches ? "dark" : "light");
  const saved = savedTheme();
  apply(saved === "dark" || saved === "light" ? saved : systemTheme());

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector("[data-theme-toggle]");
    if (!button) return;
    // aria-pressed tells screen readers whether dark mode is on
    const sync = () => button.setAttribute("aria-pressed", String(root.classList.contains("dark")));
    sync();
    // The system setting changed (say, dark mode at sunset): follow it, unless the visitor picked one
    if (system && system.addEventListener) system.addEventListener("change", () => {
      const picked = savedTheme();
      if (picked !== "dark" && picked !== "light") { apply(systemTheme()); sync(); }
    });
    button.addEventListener("click", () => {
      const theme = root.classList.contains("dark") ? "light" : "dark";
      apply(theme);
      sync();
      // Remember it only when it differs from the device; otherwise follow the device again
      save(theme === systemTheme() ? null : theme);
    });
  });
})();
