/* ==========================================================================
   Terminal behavior
   - A working COMMAND? prompt on every page (type HELP)
   - Boot screen on the home page (once per visit, skippable)

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
  const LINKEDIN = "https://www.linkedin.com/in/alexander-kashyap/";
  const GITHUB = "https://github.com/amkashyap1220";

  const body = document.body;
  const root = body.dataset.root || "./";
  const page = body.dataset.page || "home";
  const currentSlug = body.dataset.project || "";
  const RESUME = root + "assets/Alexander_Kashyap_Resume.pdf";

  // ---------- Boot screen (home page only) ----------
  const boot = document.querySelector(".boot");
  if (boot) {
    let seen = false;
    try { seen = sessionStorage.getItem("booted") === "1"; } catch (e) { /* storage blocked */ }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) {
      boot.classList.add("done");
    } else {
      const lines = [
        "ALEXANDERK-DEV TERMINAL  VT102",
        "",
        "MEMORY TEST . . . . . . 640K OK",
        "CONNECTING  . . . . . . 9600 8N1",
        "LOADING PROFILE . . . . OK",
        "",
        "COMMAND? WHOAMI",
      ];
      let i = 0;
      const finish = () => {
        clearInterval(timer);
        boot.classList.add("done");
        try { sessionStorage.setItem("booted", "1"); } catch (e) { /* ignore */ }
      };
      const timer = setInterval(() => {
        if (i < lines.length) boot.textContent += lines[i++] + "\n";
        else { clearInterval(timer); setTimeout(finish, 350); }
      }, 140);
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
  const scroller = document.querySelector(".scroll");
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
    if (/^\d+$/.test(n)) return PROJECTS[Number(n) - 1];
    return PROJECTS.find((p) => p.slug === n || p.aliases.includes(n));
  }
  function openProject(p) { go(root + "projects/" + p.slug + "/", p.slug); }

  function dir() {
    if (page === "home") {
      print("  PROJECTS/        YOUR NEXT STOP");
      print("  RESUME.PDF       DOWNLOAD WITH RESUME");
      print("  LINKEDIN.URL     OPEN WITH LINKEDIN");
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
      print("  DIR             LIST WHAT'S HERE");
      print("  CD <DIR>        CD PROJECTS, CD .., CD ~");
      print("  OPEN <NAME>     OPEN A PROJECT (OR TYPE ITS NUMBER)");
      print("  RESUME          DOWNLOAD MY RESUME");
      print("  LINKEDIN        OPEN MY LINKEDIN");
      print("  GITHUB          VIEW THE CODE");
      print("  WHOAMI          WHO IS THIS?");
      print("  CLS             CLEAR THE SCREEN");
    },
    dir, ls: dir,
    cd,
    open(arg) {
      if (!arg) return print("?USAGE: OPEN <NAME>");
      if (/resume/i.test(arg)) return COMMANDS.resume();
      if (/linkedin/i.test(arg)) return COMMANDS.linkedin();
      const p = findProject(arg);
      if (p) return openProject(p);
      print("?FILE NOT FOUND: " + arg.toUpperCase());
    },
    projects() { page === "projects" ? dir() : go(root + "projects/", "projects"); },
    about() { go(root, "home"); },
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
    whoami() {
      print("ALEXANDER KASHYAP");
      print("SOFTWARE DEVELOPER, CHICAGO, IL AREA");
    },
    cls() { out.innerHTML = ""; },
    clear() { out.innerHTML = ""; },
    exit() { print("NO CARRIER"); },
    sudo() { print("?ACCESS DENIED. THIS INCIDENT WILL BE REPORTED"); },
    nav() { print("COURSE (0-9)? ...SORRY, CAPTAIN. TYPE HELP"); },
  };

  function run(raw) {
    const text = raw.trim();
    blank();
    print("COMMAND? " + text.toUpperCase());
    if (!text) return;
    const [cmd, ...rest] = text.split(/\s+/);
    const fn = COMMANDS[cmd.toLowerCase()];
    if (fn) fn(rest.join(" "));
    else if (/^cd\.\.$/i.test(cmd)) cd("..");
    else if (findProject(cmd) && (page === "projects" || !/^\d+$/.test(cmd))) openProject(findProject(cmd));
    else print("?SYNTAX ERROR. TYPE HELP");
  }

  input.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value;
    if (value.trim()) { history.push(value); histPos = history.length; }
    input.value = "";
    sync();
    run(value);
    line.scrollIntoView({ block: "nearest" });
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

  if (scroller) scroller.focus({ preventScroll: true });  // so arrow keys and space scroll the screen
})();
