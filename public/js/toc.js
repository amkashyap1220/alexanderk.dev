/* ==========================================================================
   "On this page" in the sidebar (wide screens only): a link to each section
   title (h2) in <main>, and to a walkthrough's steps (h3), with the one you're reading marked. Pages that draw their
   sections later (the fitness dashboard) are picked up when they appear.
   With fewer than two sections the list stays hidden.
   ========================================================================== */

(() => {
  const toc = document.querySelector(".toc");
  const main = document.querySelector("main");
  if (!toc || !main) return;
  const list = toc.querySelector("ol");
  let observer;

  const slug = (text) => text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";

  function build() {
    // Every section title in the page (not card titles), plus a walkthrough's numbered steps
    const headings = [...main.querySelectorAll("h2, #walkthrough h3")].filter((h) => !h.matches(".sr-only, .card h2, .post-card h2") && h.textContent.trim());
    const key = headings.map((h) => h.textContent).join("|");
    if (key === toc.dataset.key) return;
    toc.dataset.key = key;
    list.replaceChildren();
    observer?.disconnect();
    toc.hidden = headings.length < 2;
    if (toc.hidden) return;

    const used = new Set();
    const links = new Map();
    for (const h of headings) {
      if (!h.id) {
        let id = slug(h.textContent), n = 2;
        while (used.has(id) || document.getElementById(id)) id = slug(h.textContent) + "-" + n++;
        h.id = id;
      }
      used.add(h.id);
      const a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent.trim();
      const li = document.createElement("li");
      if (h.tagName === "H3") li.className = "toc-sub";
      li.append(a);
      list.append(li);
      links.set(h, a);
    }

    // Mark the last section title that has scrolled past the top third of the screen
    const mark = () => {
      let current = headings[0];
      for (const h of headings) if (h.getBoundingClientRect().top < innerHeight / 3) current = h;
      for (const [h, a] of links) h === current ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current");
    };
    observer = new IntersectionObserver(mark, { rootMargin: "0px 0px -66% 0px" });
    headings.forEach((h) => observer.observe(h));
    mark();
  }

  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(build, 100); }).observe(main, { childList: true, subtree: true });
  build();
})();
