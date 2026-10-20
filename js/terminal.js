/* ==========================================================================
   alexanderk.dev — a small zsh look-alike in the browser.

   The site is navigated only by typing. There's a pretend filesystem:

     ~/resume.txt  github.webloc  linkedin.webloc
     ~/projects/<project>/README.txt  github.webloc

   - `cat` shows a file using its <template id="tpl-..."> from index.html.
   - `open` opens .webloc files (macOS website shortcuts) in a new tab.
   - `cd` changes directory without reloading the page, and updates the
     address bar (e.g. /projects/switch-to-youtube) so links can be shared.

   To add a project: add it to PROJECTS below, then add a
   <template id="tpl-readme-SLUG"> and a table row in index.html.
   ========================================================================== */

(function () {
  // ---------------------------------------------------------------- settings
  const USER = "alexander";
  const HOST = "alexanderk-dev";
  const HOME = "/Users/" + USER;            // what `pwd` shows for ~
  const LINKEDIN = "https://www.linkedin.com/in/alexander-kashyap/";
  const GITHUB = "https://github.com/amkashyap1220";
  const PROJECTS = [
    { slug: "switch-to-youtube", repo: "https://github.com/amkashyap1220/SwitchToYoutube" },
    { slug: "alexanderk-dev", repo: "https://github.com/amkashyap1220/alexanderk.dev" },
  ];


  // ---------------------------------------------------------------- the filesystem
  // DIRS: each directory and what's in it (in the order `ls` shows).
  // FILES: each file. Text files point to a template; .webloc files hold a link.
  // URLS: the address-bar path for each directory.
  const DIRS = {
    "~": ["resume.txt", "projects", "github.webloc", "linkedin.webloc"],
    "~/projects": PROJECTS.map((p) => p.slug),
  };
  const FILES = {
    "~/resume.txt": { template: "resume" },
    "~/github.webloc": { link: GITHUB, label: "GitHub" },
    "~/linkedin.webloc": { link: LINKEDIN, label: "LinkedIn" },
  };
  const URLS = { "~": "/", "~/projects": "/projects" };

  PROJECTS.forEach((p) => {
    const dir = "~/projects/" + p.slug;
    DIRS[dir] = ["README.txt", "github.webloc"];
    FILES[dir + "/README.txt"] = { template: "readme-" + p.slug };
    FILES[dir + "/github.webloc"] = { link: p.repo, label: p.repo.replace("https://", "") };
    URLS[dir] = "/projects/" + p.slug;
  });

  const isDir = (path) => Object.hasOwn(DIRS, path);
  const isFile = (path) => Object.hasOwn(FILES, path);
  const repoFor = (dir) => (PROJECTS.find((p) => dir === "~/projects/" + p.slug) || {}).repo;

  // macOS paths ignore upper/lower case, so look paths up in lowercase
  const EXACT_NAME = {};
  Object.keys(DIRS).concat(Object.keys(FILES)).forEach((path) => { EXACT_NAME[path.toLowerCase()] = path; });

  let cwd = "~";        // current directory
  let oldpwd = null;    // previous directory, for `cd -`

  // Turns what the visitor typed (like "../resume.txt" or "~/projects") into a full path.
  // Returns { path: "~/..." } for anything inside ~, or { outside: "/..." } for anything above it.
  function resolve(typed) {
    let p = (typed || "").trim();
    if (/^\/+$/.test(p)) return { path: "~" };       // "/" is the site's root, so treat it as home
    p = p.replace(/\/+$/, "") || ".";

    let parts;
    if (p === "~" || p.startsWith("~/")) { parts = []; p = p.slice(2); }
    else if (p.toLowerCase() === HOME.toLowerCase() || p.toLowerCase().startsWith(HOME.toLowerCase() + "/")) { parts = []; p = p.slice(HOME.length + 1); }
    else if (p.startsWith("/")) return { outside: p };
    else parts = cwd.split("/").slice(1);            // relative to where we are

    for (const piece of p.split("/")) {
      if (!piece || piece === ".") continue;
      if (piece === "..") {
        if (!parts.length) return { outside: "/Users" };
        parts.pop();
      } else parts.push(piece);
    }
    const path = "~" + (parts.length ? "/" + parts.join("/") : "");
    return { path: EXACT_NAME[path.toLowerCase()] || path };
  }


  // ---------------------------------------------------------------- page elements
  const out = document.querySelector(".out");         // where output goes
  const line = document.querySelector(".cmdline");    // the prompt line
  const input = line.querySelector("input");
  const promptEl = line.querySelector(".ps");
  const beforeCursor = line.querySelector(".before");
  const cursor = line.querySelector(".cur");
  const afterCursor = line.querySelector(".after");


  // ---------------------------------------------------------------- printing
  function span(text, cls) {
    const s = document.createElement("span");
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
  }

  // print("plain text", ["colored text", "g b"], ...) adds one line of output
  function print(...pieces) {
    const div = document.createElement("div");
    div.className = "ln";
    pieces.forEach((p) => div.append(typeof p === "string" ? p : span(p[0], p[1])));
    out.append(div);
  }
  const printError = (text) => print([text, "r"]);

  // Adds an element (or a template's contents) to the output, and fills in live GitHub numbers inside it
  function printElement(content) {
    const wrapper = document.createElement("div");
    wrapper.append(content);
    out.append(wrapper);
    if (window.GH) window.GH.fill(wrapper);
  }

  // `cat` output: the file's template inside a viewer card with a "File: name" bar
  function printFile(path) {
    const body = document.createElement("div");
    body.className = "doc-body";
    body.append(document.getElementById("tpl-" + FILES[path].template).content.cloneNode(true));

    // size shown in the bar: count the visible text only, not the HTML indentation
    const lines = body.textContent.split("\n").map((l) => l.trim()).filter(Boolean);
    const kb = (new Blob([lines.join("\n")]).size / 1024).toFixed(1);

    const bar = document.createElement("header");
    bar.className = "doc-bar";
    const name = span("", "");
    name.append(span("File: ", "d"), span(path.split("/").pop(), "w b"));
    bar.append(name, span(lines.length + " lines · " + kb + " KB · UTF-8", "d"));

    const card = document.createElement("article");
    card.className = "doc";
    card.append(bar, body);
    printElement(card);
  }

  // The colored prompt: alexander@alexanderk-dev ~/projects git:(main) %
  function promptFor(dir) {
    const frag = document.createDocumentFragment();
    frag.append(span(USER + "@" + HOST, "user"), " ", span(dir, "path"));
    if (repoFor(dir)) {
      const git = span("git:(", "git");
      git.append(span("main", "branch"), ")");
      frag.append(" ", git);
    }
    frag.append(" % ");
    return frag;
  }

  // Shows a command as typed, after its prompt
  function echo(command) {
    const div = document.createElement("div");
    div.className = "ln ps";                       // "ps" gives the prompt its colors
    div.append(promptFor(cwd), command);
    out.append(div);
  }

  const scrollToPrompt = () => line.scrollIntoView({ block: "nearest" });


  // ---------------------------------------------------------------- changing directory
  // No page reload: update the prompt, the tab title, and the address bar.
  function changeDir(dir) {
    oldpwd = cwd;
    cwd = dir;
    promptEl.textContent = "";
    promptEl.append(promptFor(cwd));
    document.title = USER + "@" + HOST + ": " + cwd;
    try { history.replaceState(null, "", URLS[cwd]); } catch (e) { /* not allowed when opened as a local file */ }
  }


  // ---------------------------------------------------------------- ls helpers
  // Colors like macOS with CLICOLOR: folders bold blue, links cyan
  function coloredName(dir, name) {
    if (isDir(dir + "/" + name) || name === "." || name === "..") return [name, "bl b"];
    if (name.endsWith(".webloc")) return [name, "c"];
    return [name, ""];
  }

  function listLong(dir, showHidden) {
    const names = (showHidden ? [".", ".."] : []).concat(DIRS[dir]);
    print("total " + names.length * 8);
    names.forEach((name) => {
      const folder = name === "." || name === ".." || isDir(dir + "/" + name);
      print([folder ? "drwxr-xr-x" : "-rw-r--r--", "d"], "  ", [USER, "y"], "  ", ["staff", "d"], "  ",
        (folder ? "96" : "1024").padStart(6), "  ", ["Oct 20 2026", "d"], "  ", coloredName(dir, name));
    });
  }


  // ---------------------------------------------------------------- commands
  // Each command gets the words typed after it, e.g. "ls -la projects" -> ls(["-la", "projects"])
  const MANUAL = {
    ls: ["ls [-la] [dir]", "list files"],
    cd: ["cd <dir>", "change directory (cd projects, cd .., cd ~, cd -)"],
    cat: ["cat <file>", "view a file (cat resume.txt)"],
    open: ["open <file>", "open a link in a new tab (open linkedin.webloc)"],
    pwd: ["pwd", "print the current directory"],
    history: ["history", "commands you've run"],
    clear: ["clear", "clear the screen (or Ctrl+L)"],
    man: ["man <command>", "show help for a command"],
  };

  const COMMANDS = {
    ls(args) {
      const flags = args.filter((a) => a.startsWith("-")).join("");
      const targets = args.filter((a) => !a.startsWith("-"));
      if (!targets.length) targets.push(".");
      targets.forEach((t) => {
        const r = resolve(t);
        if (r.outside) return printError("ls: " + t + ": Permission denied");
        if (isFile(r.path)) return print(coloredName("", r.path.split("/").pop()));
        if (!isDir(r.path)) return printError("ls: " + t + ": No such file or directory");
        if (targets.length > 1) print(t + ":");

        // In ~/projects, `ls -l` shows the projects table with live GitHub stats
        if (flags.includes("l") && r.path === "~/projects" && !flags.includes("a")) {
          return printElement(document.getElementById("tpl-projects-table").content.cloneNode(true));
        }
        if (flags.includes("l")) return listLong(r.path, flags.includes("a"));

        const row = document.createElement("div");
        row.className = "cols";
        (flags.includes("a") ? [".", ".."] : []).concat(DIRS[r.path])
          .forEach((name) => { const [text, cls] = coloredName(r.path, name); row.append(span(text, cls)); });
        printElement(row);
      });
    },

    cd(args) {
      const t = args[0] || "~";
      if (t === "-") {
        if (!oldpwd) return printError("cd: OLDPWD not set");
        print(oldpwd);
        return changeDir(oldpwd);
      }
      const r = resolve(t);
      if (r.outside) return printError("cd: permission denied: " + r.outside);
      if (isFile(r.path)) return printError("cd: not a directory: " + t);
      if (!isDir(r.path)) return printError("cd: no such file or directory: " + t);
      changeDir(r.path);                     // like zsh, prints nothing when it works
    },

    cat(args) {
      if (!args.length) return print(["usage: cat <file>   ", "r"], ["(try: cat resume.txt)", "d"]);
      args.forEach((t) => {
        const r = resolve(t);
        if (r.outside) return printError("cat: " + t + ": Permission denied");
        if (isDir(r.path)) return printError("cat: " + t + ": Is a directory");
        if (!isFile(r.path)) return printError("cat: " + t + ": No such file or directory");
        const file = FILES[r.path];
        if (file.template) return printFile(r.path);
        // A .webloc file is a small XML file holding one URL; show it as it really looks
        print(['<?xml version="1.0" encoding="UTF-8"?>', "d"]);
        print(['<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">', "d"]);
        print(['<plist version="1.0">', "d"]);
        print(["<dict>", "d"]);
        print(["    <key>", "d"], ["URL", "y"], ["</key>", "d"]);
        print(["    <string>", "d"], [file.link, "c"], ["</string>", "d"]);
        print(["</dict>", "d"]);
        print(["</plist>", "d"]);
      });
    },

    // Like macOS `open`: opens .webloc files and URLs in the browser.
    // (On a real Mac, opening a text file launches an editor, so this points you to cat.)
    open(args) {
      const targets = args.filter((a) => !a.startsWith("-"));
      if (!targets.length) return print(["Usage: open <file.webloc>", "r"], ["   (try: open linkedin.webloc)", "d"]);
      targets.forEach((t) => {
        if (/^https?:\/\//i.test(t)) {
          window.open(t, "_blank", "noopener");
          return print(["Opening " + t.replace(/^https?:\/\//i, "") + " in a new tab…", "d"]);
        }
        const r = resolve(t);
        if (r.outside || (!isDir(r.path) && !isFile(r.path))) {
          return printError("The file " + (r.outside || HOME + r.path.slice(1)) + " does not exist.");
        }
        if (isDir(r.path)) return print(["open: " + t + " is a folder. Use: ", "y"], ["cd " + t, "g"]);
        const file = FILES[r.path];
        if (!file.link) return print(["open: " + t + " is a text file. Use: ", "y"], ["cat " + t, "g"]);
        window.open(file.link, "_blank", "noopener");
        print(["Opening " + file.label + " in a new tab…", "d"]);
      });
    },

    pwd() { print(HOME + cwd.slice(1)); },
    whoami() { print(USER); },
    hostname() { print(HOST); },
    clear() { out.textContent = ""; },
    echo(args) { print(args.join(" ")); },
    date() { print(dateString(true)); },

    history() {
      loadHistory().forEach((cmd, i) => print([String(i + 1).padStart(5), "d"], "  ", cmd));
    },

    man(args) {
      const name = (args[0] || "").toLowerCase();
      if (!name) return print("What manual page do you want?");
      if (!MANUAL[name]) return print("No manual entry for " + name);
      const [usage, about] = MANUAL[name];
      print([name.toUpperCase() + "(1)", "b"]);
      print("");
      print(["NAME", "b"]);
      print("     " + name + " – " + about);
      print(["SYNOPSIS", "b"]);
      print("     ", [usage, "g"]);
    },

    git(args) {
      if (!repoFor(cwd)) return printError("fatal: not a git repository (or any of the parent directories): .git");
      if (args[0] === "status") { print("On branch main"); return print("nothing to commit, working tree clean"); }
      if (args[0] === "log") return COMMANDS.open(["github.webloc"]);
      print("usage: git status | git log");
    },

    sudo() { print("Sorry, user " + USER + " may not run sudo on " + HOST + "."); },

    exit() {
      print("logout");
      print("");
      print("[Process completed]");
      line.classList.add("off");
      input.disabled = true;
      // any key or click starts a new session
      const restart = () => { location.href = "/"; };
      setTimeout(() => {
        document.addEventListener("keydown", restart, { once: true });
        document.addEventListener("click", restart, { once: true });
      }, 50);
    },
  };
  COMMANDS.logout = COMMANDS.exit;
  COMMANDS.more = COMMANDS.cat;
  COMMANDS.less = COMMANDS.cat;

  // Names offered by Tab completion
  const COMMAND_NAMES = ["cat", "cd", "clear", "date", "echo", "exit", "git", "history", "ls", "man", "open", "pwd", "whoami"];


  // ---------------------------------------------------------------- running what was typed
  // Splits a line into words, keeping "quoted text" together
  function words(text) {
    return (text.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((w) => w.replace(/^(["'])(.*)\1$/, "$2"));
  }

  function run(typed) {
    echo(typed);
    const text = typed.trim();
    if (!text) return;
    saveToHistory(text);
    // "a && b" and "a; b" run one after the other
    for (const part of text.split(/\s*(?:&&|;)\s*/).filter(Boolean)) {
      if (input.disabled) break;                 // e.g. after `exit`
      const [name, ...args] = words(part);
      const command = COMMANDS[name.toLowerCase()];
      if (command && Object.hasOwn(COMMANDS, name.toLowerCase())) command(args);
      else if (isDir(resolve(name).path) || isFile(resolve(name).path)) printError("zsh: permission denied: " + name);
      else printError("zsh: command not found: " + name);
    }
  }


  // ---------------------------------------------------------------- history (kept for this browser tab)
  function loadHistory() {
    try { return JSON.parse(sessionStorage.getItem("history")) || []; } catch (e) { return []; }
  }
  function saveToHistory(cmd) {
    try { sessionStorage.setItem("history", JSON.stringify(loadHistory().concat(cmd).slice(-200))); } catch (e) { /* storage blocked */ }
  }


  // ---------------------------------------------------------------- the prompt line
  // The <input> is invisible. After every keystroke we copy its text into
  // three spans so we can draw our own block cursor where the caret is.
  function drawInput() {
    const text = input.value;
    const at = input.selectionStart ?? text.length;
    beforeCursor.textContent = text.slice(0, at);
    cursor.textContent = text[at] || " ";
    afterCursor.textContent = text.slice(at + 1);
  }
  ["input", "keyup", "click", "select", "focus"].forEach((ev) => input.addEventListener(ev, () => setTimeout(drawInput, 0)));
  input.addEventListener("focus", () => line.classList.add("focused"));
  input.addEventListener("blur", () => line.classList.remove("focused"));

  function setInput(text) {
    input.value = text;
    input.setSelectionRange(text.length, text.length);
    drawInput();
  }

  // Tab completion: command names first, then file and folder names
  function complete() {
    const typed = input.value.slice(0, input.selectionStart);
    const rest = input.value.slice(input.selectionStart);
    const parts = typed.split(/\s+/);
    const word = parts[parts.length - 1];
    let folder = "";
    let prefix;
    let options;

    if (parts.length === 1) {
      prefix = word.toLowerCase();
      options = COMMAND_NAMES.filter((c) => c.startsWith(prefix)).map((c) => ({ name: c, isFolder: false }));
    } else {
      const slash = word.lastIndexOf("/");
      folder = word.slice(0, slash + 1);           // e.g. "projects/" in "projects/sw"
      prefix = word.slice(slash + 1).toLowerCase();
      const dir = resolve(folder || ".").path;
      if (!isDir(dir)) return;
      options = DIRS[dir]
        .map((name) => ({ name, isFolder: isDir(dir + "/" + name) }))
        .filter((o) => o.name.toLowerCase().startsWith(prefix))
        .filter((o) => parts[0].toLowerCase() !== "cd" || o.isFolder);
    }
    if (!options.length) return;

    const start = typed.slice(0, typed.length - word.length);
    if (options.length === 1) {
      const o = options[0];
      return setInput(start + folder + o.name + (o.isFolder ? "/" : " ") + rest);
    }
    // Several matches: fill in what they share, or list them like zsh does
    let shared = options[0].name;
    options.forEach((o) => { while (!o.name.toLowerCase().startsWith(shared.toLowerCase())) shared = shared.slice(0, -1); });
    if (shared.length > prefix.length) return setInput(start + folder + shared + rest);
    echo(input.value);
    const row = document.createElement("div");
    row.className = "cols";
    options.forEach((o) => row.append(span(o.name + (o.isFolder ? "/" : ""), o.isFolder ? "bl b" : "")));
    printElement(row);
    scrollToPrompt();
  }

  // Keys: Enter runs, Tab completes, arrows walk history, Ctrl+C cancels, Ctrl+L clears, Ctrl+U erases
  let historyPos = loadHistory().length;
  let draft = "";                                  // what was typed before pressing ↑
  input.addEventListener("keydown", (e) => {
    const past = loadHistory();
    const key = e.key.toLowerCase();
    if (e.key === "Enter") {
      e.preventDefault();
      const typed = input.value;
      setInput("");
      run(typed);
      historyPos = loadHistory().length;
      draft = "";
      scrollToPrompt();
    } else if (e.key === "Tab") {
      e.preventDefault();
      complete();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyPos === past.length) draft = input.value;
      if (historyPos > 0) setInput(past[--historyPos]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyPos < past.length) { historyPos++; setInput(historyPos === past.length ? draft : past[historyPos]); }
    } else if (e.ctrlKey && key === "c") {
      e.preventDefault();
      echo(input.value + "^C");
      setInput("");
      scrollToPrompt();
    } else if ((e.ctrlKey && key === "l") || (e.metaKey && key === "k")) {
      e.preventDefault();
      COMMANDS.clear();
    } else if (e.ctrlKey && key === "u") {
      e.preventDefault();
      setInput("");
    }
  });
  line.addEventListener("submit", (e) => e.preventDefault());

  // Click or tap anywhere to type (unless selecting text to copy)
  document.addEventListener("click", () => {
    if (input.disabled || String(window.getSelection())) return;
    input.focus({ preventScroll: true });
    scrollToPrompt();
  });
  // Start typing anywhere and it goes to the prompt
  document.addEventListener("keydown", (e) => {
    if (input.disabled || document.activeElement === input || e.metaKey || e.altKey) return;
    if (e.key.length === 1 || e.key === "Tab" || e.key === "ArrowUp") {
      input.focus({ preventScroll: true });
      scrollToPrompt();
    }
  });


  // ---------------------------------------------------------------- start up
  // "Tue Oct 20 18:35:00" (and with the time zone and year for `date`)
  function dateString(full) {
    const d = new Date();
    const [weekday, month, , year, time] = d.toString().split(" ");
    const zone = ((d.toTimeString().match(/\(([^)]+)\)/) || [])[1] || "").split(" ").map((w) => w[0]).join("");
    return weekday + " " + month + " " + String(d.getDate()).padStart(2) + " " + time + (full ? " " + zone + " " + year : "");
  }

  print("Last login: " + dateString(false) + " on ttys000");

  // Open in the directory the address points to, so shared links like /projects/... work
  const path = decodeURIComponent(location.pathname).replace(/\/index\.html$/i, "/").replace(/\/+$/, "") || "/";
  const startDir = Object.keys(URLS).find((dir) => URLS[dir].toLowerCase() === path.toLowerCase());
  changeDir(startDir || "~");
  oldpwd = null;
  if (!startDir) printError("zsh: no such file or directory: " + path);

  line.classList.remove("off");
  if (window.matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
  drawInput();
})();
