/* ==========================================================================
   The unlock code box: on /unlock, and in the dialog the header's lock icon
   opens on every page. The Worker checks the code (worker/auth.js).

   The box is sent in the background so a wrong code shows its message right
   there instead of reloading the page. Without scripts both still work as
   plain forms (the icon is a link to /unlock).
   ========================================================================== */

(function () {
  const messages = {
    wrong: "That's not the code.",
    slow: "Too many tries. Wait a minute, then try again.",
    setup: "The code isn't set up yet.",
  };
  const params = new URLSearchParams(location.search);
  const onPage = location.pathname === "/unlock";

  function showError(form, text) {
    const box = form.querySelector(".unlock-error");
    box.textContent = text;
    box.hidden = !text;
  }

  document.querySelectorAll(".unlock-form").forEach((form) => {
    const code = form.elements.code;
    // On /unlock: where to go once it's unlocked, and why the last try didn't work
    if (onPage && form.closest("main")) {
      if (params.get("next")) form.elements.next.value = params.get("next");
      if (messages[params.get("error")]) showError(form, messages[params.get("error")]);
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button");
      button.disabled = true;
      try {
        // The Worker answers with a redirect: into the private section, or back to /unlock?error=...
        const res = await fetch(form.action, { method: "POST", body: new FormData(form) });
        const to = new URL(res.url);
        const error = to.pathname === "/unlock" && to.searchParams.get("error");
        if (!error) { location.href = res.url; return; }
        showError(form, messages[error] || messages.wrong);
        code.value = "";
        code.focus();
      } catch {
        form.submit();   // couldn't reach it in the background: send it the ordinary way
      } finally {
        button.disabled = false;
      }
    });
  });

  // The lock icon opens the box in place
  const dialog = document.getElementById("unlock-dialog");
  document.querySelectorAll("[data-unlock]").forEach((link) => link.addEventListener("click", (event) => {
    if (!dialog || !dialog.showModal || onPage) return;   // on /unlock the box is already there
    event.preventDefault();
    showError(dialog.querySelector("form"), "");
    dialog.showModal();
    dialog.querySelector("input[name=code]").focus();
  }));
  // Clicking outside the box closes it
  if (dialog) dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
})();
