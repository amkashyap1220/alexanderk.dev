/* ==========================================================================
   Terminal behavior
   - ASCII boxes: sizes every .abox to whole characters and draws its edges
   - Boot screen on the home page (once per visit, skippable)
   - A working COMMAND? prompt on every page (type HELP)
   - On the home page, sections live in <template id="tpl-NAME"> and get
     printed into the terminal by commands (ABOUT, EXPERIENCE, ...)

   Each page's <body> says where it is:
     data-root     path from this page back to the site root ("./", "../", ...)
     data-page     "home", "projects", or "project"
     data-project  the project's slug, on project pages
   To add a project, add it to PROJECTS below (its number is its position).
   ========================================================================== */

(function () {
  const PROJECTS = [
    {
      slug: "switch-to-youtube",
      aliases: ["switchtoyoutube", "youtube", "switch"],
      about: "FREE WEB APP: SPOTIFY PLAYLISTS -> YOUTUBE MUSIC",
      repo: "https://github.com/amkashyap1220/SwitchToYoutube",
    },
    {
      slug: "alexanderk-dev",
      aliases: ["alexanderk.dev", "site", "website"],
      about: "THIS WEBSITE",
      repo: "https://github.com/amkashyap1220/alexanderk.dev",
    },
  ];
  // Home-page menu: number -> command
  const MENU = ["about", "experience", "education", "skills", "projects", "resume", "linkedin"];
  const SECTIONS = ["about", "experience", "education", "skills"];   // printed from templates

  const LINKEDIN = "https://www.linkedin.com/in/alexander-kashyap/";
  const GITHUB = "https://github.com/amkashyap1220";

  const body = document.body;
  const root = body.dataset.root || "./";
  const page = body.dataset.page || "home";
  const currentSlug = body.dataset.project || "";
  const RESUME = root + "assets/Alexander_Kashyap_Resume.pdf";
  const term = document.querySelector(".term");
  const scroller = document.querySelector(".scroll");

  // ---------- ASCII boxes ----------
  let cw = 0;
  function measure() {
    const probe = document.createElement("span");
    probe.textContent = "M".repeat(100);
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
    term.appendChild(probe);
    cw = probe.getBoundingClientRect().width / 100;
    probe.remove();
    document.documentElement.style.setProperty("--cw", cw + "px");
  }
  function frame(box) {
    if (!cw) return;
    box.style.width = "";
    const avail = box.parentElement.clientWidth -
      parseFloat(getComputedStyle(box.parentElement).paddingLeft) -
      parseFloat(getComputedStyle(box.parentElement).paddingRight);
    const n = Math.floor(avail / cw);
    if (n < 12) { box.classList.remove("framed"); return; }
    box.style.width = n * cw + "px";

    let top = box.querySelector(":scope > .edge.top");
    let bottom = box.querySelector(":scope > .edge.bottom");
    if (!top) {
      top = document.createElement("div");
      top.className = "edge top";
      top.setAttribute("aria-hidden", "true");
      box.prepend(top);
      bottom = document.createElement("div");
      bottom.className = "edge bottom";
      bottom.setAttribute("aria-hidden", "true");
      box.append(bottom);
    }
    const title = (box.dataset.title || "").toUpperCase();
    const head = title ? "+--[ " : "+";
    const tail = title ? " ]" : "";
    const dashes = Math.max(0, n - head.length - title.length - tail.length - 1);
    top.innerHTML = "";
    top.append(head);
    if (title) {
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = title;
      top.append(t);
    }
    top.append(tail + "-".repeat(dashes) + "+");
    bottom.textContent = "+" + "-".repeat(n - 2) + "+";
    box.classList.add("framed");
  }
  function frameAll(scope) {
    (scope || document).querySelectorAll(".abox").forEach(frame);
  }
  function setupBoxes() { measure(); frameAll(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setupBoxes);
  setupBoxes();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setupBoxes, 120);
  });

  // ---------- Boot screen (home page only) ----------
  const boot = document.querySelector(".boot");
  const startSection = page === "home" ? location.hash.slice(1).toLowerCase() : "";
  if (boot) {
    let seen = false;
    try { seen = sessionStorage.getItem("booted") === "1"; } catch (e) { /* storage blocked */ }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce || startSection) {
      boot.classList.add("done");
    } else {
      const lines = [
        "ALEXANDERK-DEV TERMINAL  VT102",
        "",
        "MEMORY TEST . . . . . . 640K OK",
        "CONNECTING  . . . . . . 9600 8N1",
        "LOADING PROFILE . . . . OK",
      ];
      let i = 0;
      const finish = () => {
        clearInterval(timer);
        boot.classList.add("done");
        try { sessionStorage.setItem("booted", "1"); } catch (e) { /* ignore */ }
        setupBoxes();
      };
      const timer = setInterval(() => {
        if (i < lines.length) boot.textContent += lines[i++] + "\n";
        else { clearInterval(timer); setTimeout(finish, 450); }
      }, 150);
      boot.addEventListener("click", finish);
      document.addEventListener("keydown", finish, { once: true });
    }
  }

  // ---------- Command line ----------
  const line = document.querySelector(".cmdline");
  if (!line) return;
  const input = line.querySelector("input");
  const typed = line.querySelector(".typed");
  const out = document.querySelector(".prompt-output");
  const history = [];
  let histPos = 0;

  const sync = () => { typed.textContent = input.value; };
  input.addEventListener("input", sync);
  input.addEventListener("focus", () => line.classList.add("focused"));
  input.addEventListener("blur", () => line.classList.remove("focused"));
  line.addEventListener("click", () => input.focus());

  function print(text) {
    const div = document.createElement("div");
    div.textContent = text;
    out.appendChild(div);
  }
  function blank() { print(""); }
  function printTemplate(name) {
    const tpl = document.getElementById("tpl-" + name);
    if (!tpl) return false;
    const wrap = document.createElement("div");
    wrap.className = "printed";
    wrap.appendChild(tpl.content.cloneNode(true));
    out.appendChild(wrap);
    frameAll(wrap);
    return true;
  }
  function go(url, label) {
    blank();
    print("NOW ENTERING " + label.toUpperCase() + " . . .");
    setTimeout(() => { location.href = url; }, 350);
  }
  function openTab(url, label) {
    print("OPENING " + label + " . . .");
    window.open(url, "_blank", "noopener");
  }
  function findProject(name) {
    const n = (name || "").toLowerCase().replace(/\/$/, "").replace(/^projects\//, "");
    if (/^\d+$/.test(n)) return page === "projects" ? PROJECTS[Number(n) - 1] : undefined;
    return PROJECTS.find((p) => p.slug === n || p.aliases.includes(n));
  }
  function openProject(p) { go(root + "projects/" + p.slug + "/", p.slug); }

  function section(name) {
    if (page === "home" && printTemplate(name)) return;
    go(root + "#" + name, "home");   // other pages (and the 404): jump home and print it there
  }

  function dir() {
    if (page === "home") {
      print("  ABOUT.TXT  EXPERIENCE.TXT  EDUCATION.TXT  SKILLS.TXT");
      print("  PROJECTS/  RESUME.PDF      LINKEDIN.URL");
    } else if (page === "projects") {
      PROJECTS.forEach((p, i) => print("  " + (i + 1) + "  " + p.slug.toUpperCase().padEnd(20) + p.about));
      print("");
      print("SELECT A NUMBER OR TYPE OPEN <NAME>");
    } else {
      print("  README.TXT       (THIS SCREEN)");
      print("  SOURCE           TYPE GITHUB TO VIEW THE CODE");
    }
  }

  function cd(arg) {
    const a = (arg || "").toLowerCase().replace(/\\/g, "/").replace(/\/$/, "");
    if (!a || a === "~" || a === "/") return go(root, "home");
    if (a === "..") {
      if (page === "project") return go(root + "projects/", "projects");
      if (page === "projects") return go(root, "home");
      return print("ALREADY AT THE TOP. TRY DIR");
    }
    if (a === "projects") return go(root + "projects/", "projects");
    const p = findProject(a);
    if (p) return openProject(p);
    print("?NO SUCH DIRECTORY: " + a.toUpperCase());
  }

  const COMMANDS = {
    help() {
      print("COMMANDS:");
      print("  ABOUT           WHO I AM");
      print("  EXPERIENCE      WHERE I'VE WORKED");
      print("  EDUCATION       SCHOOL");
      print("  SKILLS          WHAT I WORK WITH");
      print("  PROJECTS        THINGS I'VE BUILT");
      print("  OPEN <NAME>     OPEN A PROJECT");
      print("  RESUME          DOWNLOAD RESUME.PDF");
      print("  LINKEDIN        OPEN MY LINKEDIN");
      print("  GITHUB          VIEW THE CODE");
      print("  DIR / CD        LOOK AROUND (CD .., CD ~)");
      print("  CLS             CLEAR THE SCREEN");
      if (page === "home") print("  1-7             PICK FROM THE MENU");
      if (page === "projects") print("  1-" + PROJECTS.length + "             OPEN A PROJECT BY NUMBER");
    },
    about() { section("about"); },
    whoami() { section("about"); },
    experience() { section("experience"); },
    education() { section("education"); },
    skills() { section("skills"); },
    dir, ls: dir,
    cd,
    type(arg) {
      const n = (arg || "").toLowerCase().replace(/\.txt$/, "");
      if (SECTIONS.includes(n)) return section(n);
      print("?FILE NOT FOUND: " + (arg || "").toUpperCase());
    },
    open(arg) {
      if (!arg) return print("?USAGE: OPEN <NAME>");
      if (/resume/i.test(arg)) return COMMANDS.resume();
      if (/linkedin/i.test(arg)) return COMMANDS.linkedin();
      const p = findProject(arg);
      if (p) return openProject(p);
      print("?FILE NOT FOUND: " + arg.toUpperCase());
    },
    projects() { page === "projects" ? dir() : go(root + "projects/", "projects"); },
    home() { go(root, "home"); },
    resume() {
      print("DOWNLOADING RESUME.PDF . . .");
      const a = document.createElement("a");
      a.href = RESUME;
      a.download = "Alexander_Kashyap_Resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    linkedin() { openTab(LINKEDIN, "LINKEDIN"); },
    github() {
      const p = PROJECTS.find((x) => x.slug === currentSlug);
      openTab(p ? p.repo : GITHUB, "GITHUB");
    },
    cls() { out.innerHTML = ""; },
    clear() { out.innerHTML = ""; },
    exit() { print("NO CARRIER"); },
    sudo() { print("?ACCESS DENIED. THIS INCIDENT WILL BE REPORTED"); },
  };

  function run(raw) {
    const text = raw.trim();
    blank();
    print("COMMAND? " + text.toUpperCase());
    if (!text) return;
    const [cmd, ...rest] = text.split(/\s+/);
    const key = cmd.toLowerCase();
    if (page === "home" && /^\d+$/.test(key) && MENU[Number(key) - 1]) return COMMANDS[MENU[Number(key) - 1]]();
    const fn = COMMANDS[key];
    if (fn) return fn(rest.join(" "));
    if (/^cd\.\.$/i.test(cmd)) return cd("..");
    const p = findProject(cmd);
    if (p) return openProject(p);
    print("?SYNTAX ERROR. TYPE HELP");
  }

  function submit(value) {
    if (value.trim()) { history.push(value); histPos = history.length; }
    run(value);
    line.scrollIntoView({ block: "nearest" });
  }

  input.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = "";
    sync();
    submit(value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && histPos > 0) {
      input.value = history[--histPos];
      sync();
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      histPos = Math.min(histPos + 1, history.length);
      input.value = history[histPos] || "";
      sync();
      e.preventDefault();
    }
  });

  // Menu items on the welcome screen run their command, as if typed
  document.querySelectorAll("[data-run]").forEach((btn) => {
    btn.addEventListener("click", () => submit(btn.dataset.run));
  });

  // Start typing anywhere and it goes to the command line
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.activeElement === input) return;
    if (boot && !boot.classList.contains("done")) return;
    if (/^[a-z0-9.~\/\\-]$/i.test(e.key)) {
      input.focus();
      line.scrollIntoView({ block: "nearest" });
    }
  });

  // Arriving from another page with ABOUT/EXPERIENCE/...: print it right away
  if (startSection && SECTIONS.includes(startSection)) {
    run(startSection);
    history.push(startSection);
    histPos = history.length;
    line.scrollIntoView({ block: "nearest" });
  }

  if (scroller) scroller.focus({ preventScroll: true });  // so arrow keys and space scroll the screen
})();
