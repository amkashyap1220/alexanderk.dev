/* ==========================================================================
   Terminal behavior
   The whole site is navigated by typing commands at the COMMAND? prompt.

   - ASCII boxes: sizes every .abox to whole characters and draws its edges
   - Boot screen on the home page (once per visit, skippable)
   - The command line (type HELP)
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
      dosName: "SWITCH~1",
      aliases: ["switchtoyoutube", "switch", "youtube"],
      about: "FREE WEB APP: SPOTIFY PLAYLISTS -> YOUTUBE MUSIC",
      repo: "https://github.com/amkashyap1220/SwitchToYoutube",
    },
    {
      slug: "alexanderk-dev",
      dosName: "ALEXAN~1",
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
  const current = PROJECTS.find((p) => p.slug === currentSlug);
  const RESUME = root + "assets/Alexander_Kashyap_Resume.pdf";
  const term = document.querySelector(".term");
  const WHERE = page === "projects" ? "C:\\PROJECTS"
    : page === "project" ? "C:\\PROJECTS\\" + (PROJECTS.find((p) => p.slug === currentSlug) || {}).dosName
    : page === "notfound" ? "C:\\???" : "C:\\";
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
    const parent = box.parentElement;
    const cs = getComputedStyle(parent);
    const avail = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
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
    let title = (box.dataset.title || "").toUpperCase();
    const room = n - 9;                       // "+--[ " + " ]" + at least one "-" and the corner
    if (title.length > room) title = title.slice(0, Math.max(1, room - 1)) + "~";   // DOS-style short name
    const head = title ? "+--[ " : "+";
    const tail = title ? " ]" : "";
    const dashes = Math.max(0, n - head.length - title.length - tail.length - 1);
    top.textContent = "";
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
  function frameAll(scope) { (scope || document).querySelectorAll(".abox").forEach(frame); }
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

  // Clicking or tapping anywhere on the screen focuses the prompt (so phones get a keyboard),
  // unless the visitor is selecting text to copy.
  document.querySelector(".crt").addEventListener("click", () => {
    if (boot && !boot.classList.contains("done")) return;
    if (String(window.getSelection())) return;
    input.focus({ preventScroll: true });
  });

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
    input.disabled = true;
    setTimeout(() => { location.href = url; }, 350);
  }
  function openTab(url, label) {
    print("OPENING " + label + " IN A NEW WINDOW . . .");
    window.open(url, "_blank", "noopener");
  }
  function clean(arg) {
    return (arg || "").toLowerCase().trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  }
  function findProject(name) {
    const n = clean(name).replace(/^(~\/|\/)?projects\//, "");
    if (!n) return undefined;
    if (/^\d+$/.test(n)) return page === "projects" ? PROJECTS[Number(n) - 1] : undefined;
    return PROJECTS.find((p) => p.slug === n || p.dosName.toLowerCase() === n || p.aliases.includes(n));
  }
  function openProject(p) { go(root + "projects/" + p.slug + "/", p.slug); }

  // Prints a home-page section; from other pages, goes home and prints it there.
  function section(name) {
    if (page === "home" && printTemplate(name)) return;
    go(root + "#" + name, "home");
  }

  // ----- what's in each "directory" -----
  function dir() {
    if (page === "home") {
      print(" DIRECTORY OF C:\\");
      print("");
      print("  ABOUT       TXT      WHO I AM");
      print("  EXPERIENCE  TXT      WHERE I'VE WORKED");
      print("  EDUCATION   TXT      SCHOOL");
      print("  SKILLS      TXT      WHAT I WORK WITH");
      print("  PROJECTS    <DIR>    THINGS I'VE BUILT");
      print("  RESUME      PDF      MY RESUME");
      print("  LINKEDIN    URL      MY LINKEDIN");
      print("");
      print(" TYPE <NAME> TO READ, CD PROJECTS, OR RESUME / LINKEDIN");
    } else if (page === "projects") {
      print(" DIRECTORY OF C:\\PROJECTS");
      print("");
      print("     ..                       <DIR>");
      PROJECTS.forEach((p, i) => print("  " + (i + 1) + "  " + p.slug.toUpperCase().padEnd(22) + "<DIR>    " + p.about));
      print("");
      print(" TYPE A NUMBER OR OPEN <NAME>");
    } else if (page === "notfound") {
      print("?NOTHING HERE. TYPE CD ~ TO GO HOME");
    } else {
      print(" DIRECTORY OF C:\\PROJECTS\\" + current.dosName);
      print("");
      print("  ..          <DIR>");
      print("  README      TXT      (ON SCREEN)");
      print("  SOURCE      URL      TYPE GITHUB TO VIEW THE CODE");
    }
  }

  function cd(arg) {
    const raw = (arg || "").trim();
    const a = /^[\\/]+$/.test(raw) ? "/" : clean(arg);   // "CD \" means the root, like DOS
    if (!a) return print(WHERE);
    if (a === "~" || a === "/" || a === "c:" || a === "c:/") {
      if (page === "home") return print("?ALREADY IN C:\\. TRY DIR");
      return go(root, "home");
    }
    if (a === "..") {
      if (page === "notfound") return go(root, "home");
      if (page === "project") return go(root + "projects/", "projects");
      if (page === "projects") return go(root, "home");
      return print("?ALREADY AT THE TOP DIRECTORY. TRY DIR");
    }
    if (a === "../..") return go(root, "home");
    if (a === "projects" || a === "~/projects" || a === "/projects") {
      if (page === "projects") return print("?ALREADY IN PROJECTS. TRY DIR");
      return go(root + "projects/", "projects");
    }
    const p = findProject(a);
    if (p) {
      if (p.slug === currentSlug) return print("?ALREADY IN " + p.slug.toUpperCase());
      return openProject(p);
    }
    if (/\.(txt|pdf|url)$/.test(a) || SECTIONS.includes(a) || a === "resume" || a === "linkedin") {
      return print("?" + a.toUpperCase() + " IS A FILE, NOT A DIRECTORY. TRY TYPE OR OPEN");
    }
    print("?NO SUCH DIRECTORY: " + a.toUpperCase());
  }

  function typeFile(arg) {
    const a = clean(arg).replace(/\.txt$/, "");
    const shown = (arg || "").trim().toUpperCase();
    if (!a) return print("?USAGE: TYPE <FILE>   (TRY DIR)");
    if (SECTIONS.includes(a)) return section(a);
    if (a === "readme" && (page === "project" || page === "projects")) {
      const hidden = term.querySelectorAll(":scope > .cleared");
      if (hidden.length) {             // after CLS: bring the page's text back
        hidden.forEach((el) => { el.classList.remove("cleared"); out.before(el); });
        frameAll();
        return;
      }
      return print(page === "project" ? "README.TXT IS ALREADY ON SCREEN. SCROLL UP"
                                       : "THE READMES ARE ON SCREEN. SCROLL UP, OR OPEN <NAME>");
    }
    if (/^resume(\.pdf)?$/.test(a)) return print("?CAN'T TYPE A PDF. TYPE RESUME TO DOWNLOAD IT");
    if (/^linkedin(\.url)?$/.test(a)) return print("URL = " + LINKEDIN.toUpperCase() + "   (TYPE LINKEDIN TO OPEN IT)");
    if (findProject(a) || a === "projects") return print("?" + shown + " IS A DIRECTORY. TRY CD " + shown);
    print("?FILE NOT FOUND: " + shown);
  }

  function openThing(arg) {
    const a = clean(arg);
    if (!a) return print("?USAGE: OPEN <NAME>   (TRY DIR)");
    if (/^resume(\.pdf)?$/.test(a)) return COMMANDS.resume();
    if (/^linkedin(\.url)?$/.test(a)) return COMMANDS.linkedin();
    if (/^(github|source)$/.test(a)) return COMMANDS.github();
    if (SECTIONS.includes(a.replace(/\.txt$/, "")) || a === "readme.txt" || a === "readme") return typeFile(a);
    if (a === "projects") return cd("projects");
    const p = findProject(a);
    if (p) {
      if (p.slug === currentSlug) return print("?" + p.slug.toUpperCase() + " IS ALREADY OPEN");
      return openProject(p);
    }
    print("?FILE NOT FOUND: " + a.toUpperCase());
  }

  function showMenu() {
    const welcome = document.querySelector('.term > .abox[data-title="WELCOME"]');
    if (page !== "home" || !welcome) return go(root, "home");
    const copy = document.createElement("div");
    copy.className = "printed";
    const box = welcome.cloneNode(true);
    box.classList.remove("cleared");
    box.style.marginTop = "";
    box.querySelectorAll(".edge").forEach((e) => e.remove());
    copy.appendChild(box);
    out.appendChild(copy);
    frameAll(copy);
  }

  const COMMANDS = {
    help() {
      print("COMMANDS (TYPE ONE, THEN PRESS ENTER):");
      print("");
      print("  ABOUT          WHO I AM");
      print("  EXPERIENCE     WHERE I'VE WORKED");
      print("  EDUCATION      SCHOOL");
      print("  SKILLS         WHAT I WORK WITH");
      print("  PROJECTS       THINGS I'VE BUILT");
      print("  OPEN <NAME>    OPEN A PROJECT OR FILE");
      print("  RESUME         DOWNLOAD MY RESUME (PDF)");
      print("  LINKEDIN       OPEN MY LINKEDIN");
      print("  GITHUB         VIEW THE CODE ON GITHUB");
      print("  DIR            LIST WHAT'S HERE");
      print("  CD <DIR>       CHANGE DIRECTORY (CD PROJECTS, CD .., CD ~)");
      print("  TYPE <FILE>    READ A FILE (TYPE SKILLS.TXT)");
      print("  MENU           SHOW THE MAIN MENU");
      print("  CLS            CLEAR THE SCREEN");
      if (page === "home") { print(""); print("  OR TYPE 1-7 TO PICK FROM THE MENU"); }
      if (page === "projects") { print(""); print("  OR TYPE 1-" + PROJECTS.length + " TO OPEN A PROJECT"); }
      if (page === "project") { print(""); print("  TYPE CD .. TO GO BACK TO PROJECTS"); }
      if (page === "notfound") { print(""); print("  TYPE CD ~ TO GO HOME"); }
    },
    about() { section("about"); },
    whoami() { section("about"); },
    experience() { section("experience"); },
    work() { section("experience"); },
    education() { section("education"); },
    school() { section("education"); },
    skills() { section("skills"); },
    projects() {
      if (page === "projects") return dir();
      go(root + "projects/", "projects");
    },
    open: openThing,
    run: openThing,
    type: typeFile,
    cat: typeFile,
    more: typeFile,
    dir, ls: dir,
    cd, chdir: cd,
    back() { cd(".."); },
    home() { page === "home" ? showMenu() : go(root, "home"); },
    menu: showMenu,
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
      if (current) return openTab(current.repo, "GITHUB: " + current.slug.toUpperCase());
      openTab(GITHUB, "GITHUB");
    },
    cls() {
      out.innerHTML = "";
      Array.from(term.children).forEach((el) => {
        if (el !== out && el !== line && el.tagName !== "TEMPLATE") el.classList.add("cleared");
      });
    },
    clear() { COMMANDS.cls(); },
    ver() { print("ALEXANDERK-DEV TERMINAL VERSION 1.0"); },
    date() { print("CURRENT DATE IS " + new Date().toDateString().toUpperCase()); },
    exit() { print("NO CARRIER. (TYPE MENU TO RECONNECT)"); },
    sudo() { print("?ACCESS DENIED. THIS INCIDENT WILL BE REPORTED"); },
  };

  function run(raw) {
    const text = raw.trim();
    blank();
    print("COMMAND? " + text.toUpperCase());
    if (!text) return;

    // DOS-style shortcuts with no space: "cd..", "cd\"
    const squashed = text.match(/^cd(\.\.|\\|\/)$/i);
    if (squashed) return cd(squashed[1] === ".." ? ".." : "/");

    const [cmd, ...rest] = text.split(/\s+/);
    const key = cmd.toLowerCase();
    const arg = rest.join(" ");

    if (/^\d+$/.test(key)) {
      if (page === "home" && MENU[Number(key) - 1]) return COMMANDS[MENU[Number(key) - 1]]();
      if (page === "projects" && PROJECTS[Number(key) - 1]) return openProject(PROJECTS[Number(key) - 1]);
      const max = page === "home" ? MENU.length : page === "projects" ? PROJECTS.length : 0;   // no menu on project pages or the 404
      return print(max ? "?PICK A NUMBER FROM 1-" + max : "?NO MENU HERE. TYPE HELP");
    }
    if (Object.prototype.hasOwnProperty.call(COMMANDS, key)) return COMMANDS[key](arg);
    if (key === "..") return cd("..");
    if (SECTIONS.includes(key.replace(/\.txt$/, ""))) return section(key.replace(/\.txt$/, ""));   // typing a file name reads it
    const p = findProject(key);
    if (p && !arg) return openThing(key);                                                        // typing a project name opens it
    print("?SYNTAX ERROR: " + cmd.toUpperCase() + " IS NOT A COMMAND. TYPE HELP");
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
    } else if (e.key === "Escape") {
      input.value = "";
      sync();
    }
  });

  // Start typing anywhere and it goes to the command line
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.activeElement === input) return;
    if (boot && !boot.classList.contains("done")) return;
    if (/^[a-z0-9.~\/\\-]$/i.test(e.key)) {
      input.focus({ preventScroll: true });
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

  if (scroller) scroller.focus({ preventScroll: true });   // so arrow keys and space scroll the screen
})();
