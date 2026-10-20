/* ==========================================================================
   alexanderk.dev — zsh in the browser
   The site is navigated only by typing commands. There's a small virtual
   filesystem rooted at ~ (/Users/alexander):

     ~/about.txt  experience.txt  education.txt  skills.txt
     ~/github.webloc  linkedin.webloc
     ~/projects/<project>/README.md  github.webloc

   .webloc files are macOS website shortcuts; `open` opens them in a new tab.

   It's a single page: cd changes the directory in place (no reloads). The
   address bar follows along (/projects/switch-to-youtube) so links can be
   shared; Cloudflare serves index.html for every path (single-page mode).
   File contents live in <template id="tpl-NAME"> tags in index.html.

   To add a project: add it to PROJECTS below and add its README template
   in tools/build_pages.py.
   ========================================================================== */

(function () {
  // ---------------------------------------------------------------- data
  const USER = "alexander";
  const HOST = "alexanderk-dev";
  const LINKEDIN = "https://www.linkedin.com/in/alexander-kashyap/";
  const GITHUB = "https://github.com/amkashyap1220";
  const PROJECTS = [
    { slug: "switch-to-youtube", repo: "https://github.com/amkashyap1220/SwitchToYoutube" },
    { slug: "alexanderk-dev", repo: "https://github.com/amkashyap1220/alexanderk.dev" },
  ];

  let cwd = "~";                                      // current directory

  // Directories: name list in display order. Files: what they are.
  const DIRS = {
    "~": ["about.txt", "experience.txt", "education.txt", "skills.txt", "projects", "github.webloc", "linkedin.webloc"],
    "~/projects": PROJECTS.map((p) => p.slug),
  };
  const FILES = {
    "~/about.txt": { kind: "txt", tpl: "about" },
    "~/experience.txt": { kind: "txt", tpl: "experience" },
    "~/education.txt": { kind: "txt", tpl: "education" },
    "~/skills.txt": { kind: "txt", tpl: "skills" },
    "~/github.webloc": { kind: "webloc", href: GITHUB, label: "GitHub" },
    "~/linkedin.webloc": { kind: "webloc", href: LINKEDIN, label: "LinkedIn" },
  };
  const URLS = { "~": "/", "~/projects": "/projects" };   // address bar path for each directory
  PROJECTS.forEach((p) => {
    const dir = "~/projects/" + p.slug;
    DIRS[dir] = ["README.md", "github.webloc"];
    FILES[dir + "/README.md"] = { kind: "md", tpl: "readme-" + p.slug };
    FILES[dir + "/github.webloc"] = { kind: "webloc", href: p.repo, label: p.repo.replace("https://", "") };
    URLS[dir] = "/projects/" + p.slug;
  });

  // macOS paths are case-insensitive: look things up in lowercase
  const CANON = {};
  Object.keys(DIRS).concat(Object.keys(FILES)).forEach((k) => { CANON[k.toLowerCase()] = k; });

  const repoFor = (dir) => (PROJECTS.find((p) => dir === "~/projects/" + p.slug) || {}).repo;

  // ---------------------------------------------------------------- session (history survives reloads)
  const store = {
    get(k, fallback) { try { const v = sessionStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  // ---------------------------------------------------------------- DOM
  const out = document.querySelector(".out");
  const line = document.querySelector(".cmdline");
  const input = line.querySelector("input");
  const psEl = line.querySelector(".ps");
  const before = line.querySelector(".before");
  const cur = line.querySelector(".cur");
  const after = line.querySelector(".after");

  // ---------------------------------------------------------------- output helpers
  function span(text, cls) {
    const s = document.createElement("span");
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
  }
  // print("plain", ["colored", "g b"], ...)
  function print(...segs) {
    const d = document.createElement("div");
    d.className = "ln";
    segs.forEach((s) => d.append(typeof s === "string" ? s : span(s[0], s[1])));
    out.appendChild(d);
    return d;
  }
  const err = (text) => print([text, "r"]);
  function printNode(node) {
    const d = document.createElement("div");
    d.className = "block";
    d.appendChild(node);
    out.appendChild(d);
    if (window.GH) window.GH.fill(d);
    return d;
  }
  function printTpl(name) {
    const tpl = document.getElementById("tpl-" + name);
    if (!tpl) return false;
    printNode(tpl.content.cloneNode(true));
    return true;
  }
  function promptNodes(dir) {
    const frag = document.createDocumentFragment();
    frag.append(span(USER + "@" + HOST, "user"), " ", span(dir, "path"));
    if (repoFor(dir)) {
      const g = span("git:(", "git");
      g.append(span("main", "branch"), ")");
      frag.append(" ", g);
    }
    frag.append(" ", span("%", "sym"), " ");
    return frag;
  }
  function echo(dir, cmd) {
    const d = document.createElement("div");
    d.className = "ln ps";
    d.append(promptNodes(dir), cmd);
    out.appendChild(d);
  }
  function scrollToPrompt() { line.scrollIntoView({ block: "nearest" }); }

  // ---------------------------------------------------------------- paths
  const HOME_ABS = "/Users/" + USER;
  // Returns { key } for a path inside ~ (key may not exist), or { outside: "/abs/path" }.
  function resolve(arg, from) {
    let p = (arg || "").trim();
    if (/^\/+$/.test(p)) return { key: "~" };          // "/" is the site's root: home
    p = p.replace(/\/+$/, "") || ".";
    let segs;
    if (p === "~" || p.startsWith("~/")) { segs = []; p = p.slice(2); }
    else if (p.toLowerCase() === HOME_ABS.toLowerCase() || p.toLowerCase().startsWith(HOME_ABS.toLowerCase() + "/")) { segs = []; p = p.slice(HOME_ABS.length + 1); }
    else if (p.startsWith("/")) return { outside: p || "/" };
    else segs = (from || cwd).split("/").slice(1);
    for (const part of p.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (!segs.length) return { outside: "/Users" };
        segs.pop();
      } else segs.push(part);
    }
    const key = "~" + (segs.length ? "/" + segs.join("/") : "");
    return { key: CANON[key.toLowerCase()] || key };
  }
  const isDir = (k) => Object.prototype.hasOwnProperty.call(DIRS, k);
  const isFile = (k) => Object.prototype.hasOwnProperty.call(FILES, k);
  const abs = (k) => HOME_ABS + k.slice(1);
  const baseName = (k) => k.split("/").pop();

  // ---------------------------------------------------------------- changing directory (in place)
  let oldpwd = null;
  function setCwd(dir) {
    cwd = dir;
    psEl.textContent = "";
    psEl.append(promptNodes(cwd));
    document.title = USER + "@" + HOST + ": " + cwd;
    try { history.replaceState(null, "", URLS[cwd]); } catch (e) { /* file:// previews */ }
  }
  function go(dir) {
    oldpwd = cwd;
    setCwd(dir);
  }

  // ---------------------------------------------------------------- ls coloring
  function lsName(dir, name) {
    const k = dir === "~" ? "~/" + name : dir + "/" + name;
    if (isDir(k)) return [name, "bl b"];
    if (/\.webloc$/.test(name)) return [name, "c"];
    return [name, ""];
  }
  function lsLong(dir, showAll) {
    const names = (showAll ? [".", ".."] : []).concat(DIRS[dir]);
    print("total " + names.length * 8);
    names.forEach((name) => {
      const k = name === "." ? dir : name === ".." ? (dir.split("/").slice(0, -1).join("/") || "~") : (dir + "/" + name);
      const d = name === "." || name === ".." || isDir(k);
      const size = d ? "96" : "1024";
      const perms = d ? "drwxr-xr-x" : "-rw-r--r--";
      print([perms, "d"], "  ", [USER, "y"], "  ", ["staff", "d"], "  ", size.padStart(6), "  ", ["Oct 20 2026", "d"], "  ",
        d ? [name, "bl b"] : lsName(dir, name));
    });
  }

  // ---------------------------------------------------------------- commands
  const HELP = [
    ["ls [-la] [dir]", "list files"],
    ["cd <dir>", "change directory (cd projects, cd .., cd ~, cd -)"],
    ["cat <file>", "print a file (cat about.txt)"],
    ["open <file>", "open a link in a new tab (open linkedin.webloc)"],
    ["pwd", "print the current directory"],
    ["neofetch", "who I am, the quick version"],
    ["history", "commands you've run"],
    ["clear", "clear the screen (or Ctrl+L)"],
    ["man <command>", "show help for a command"],
  ];
  const SHORTCUTS = [
    ["about", "cat ~/about.txt"],
    ["experience", "cat ~/experience.txt"],
    ["education", "cat ~/education.txt"],
    ["skills", "cat ~/skills.txt"],
    ["projects", "cd ~/projects"],
    ["linkedin", "open ~/linkedin.webloc"],
    ["github", "open the GitHub link for where you are"],
  ];
  function helpGrid(rows) {
    const g = document.createElement("div");
    g.className = "help";
    rows.forEach(([c, d]) => g.append(span(c, "cmdname"), span(d, "d")));
    printNode(g);
  }

  const COMMANDS = {
    help() {
      print(["zsh", "b"], " on ", [HOST, "g"], " — commands:");
      helpGrid(HELP);
      print("");
      print(["shortcuts:", "b"]);
      helpGrid(SHORTCUTS);
      print("");
      print(["tips: ", "d"], "Tab completes names · ↑ ↓ browse history · Ctrl+C cancels", "");
    },

    ls(args) {
      const flags = args.filter((a) => a.startsWith("-")).join("");
      const long = flags.includes("l");
      const all = flags.includes("a");
      const targets = args.filter((a) => !a.startsWith("-"));
      if (!targets.length) targets.push(".");
      targets.forEach((t, i) => {
        const r = resolve(t);
        if (r.outside) return err("ls: " + t + ": Permission denied");
        if (isFile(r.key)) return print(lsName(r.key.split("/").slice(0, -1).join("/"), baseName(r.key)));
        if (!isDir(r.key)) return err("ls: " + t + ": No such file or directory");
        if (targets.length > 1) print((i ? "\n" : "") + t + ":");
        if (long && r.key === "~/projects" && !all) {
          printTpl("projects-table");
          return;
        }
        if (long) return lsLong(r.key, all);
        const row = document.createElement("div");
        row.className = "cols";
        (all ? [".", ".."] : []).concat(DIRS[r.key]).forEach((n) => {
          const s = n === "." || n === ".." ? [n, "bl b"] : lsName(r.key, n);
          row.append(span(s[0], s[1]));
        });
        printNode(row);
      });
    },

    cd(args, typed) {
      let t = args[0];
      if (!t) t = "~";
      if (t === "-") {
        if (!oldpwd) return err("cd: OLDPWD not set");
        print(oldpwd);
        return go(oldpwd);
      }
      const r = resolve(t);
      if (r.outside) return err("cd: permission denied: " + r.outside);
      if (isFile(r.key)) return err("cd: not a directory: " + t);
      if (!isDir(r.key)) return err("cd: no such file or directory: " + t);
      go(r.key);                                   // zsh prints nothing on success
    },

    cat(args) {
      if (!args.length) return print(["usage: cat <file>   ", "r"], ["(try: cat about.txt)", "d"]);
      args.forEach((t) => {
        const r = resolve(t);
        if (r.outside) return err("cat: " + t + ": Permission denied");
        if (isDir(r.key)) return err("cat: " + t + ": Is a directory");
        if (!isFile(r.key)) return err("cat: " + t + ": No such file or directory");
        const f = FILES[r.key];
        if (f.tpl) return printTpl(f.tpl);
        if (f.kind === "webloc") {      // a .webloc is a small XML property list holding one URL
          print(["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "d"]);
          print(["<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">", "d"]);
          print(["<plist version=\"1.0\">", "d"]);
          print(["<dict>", "d"]);
          print(["    <key>", "d"], ["URL", "y"], ["</key>", "d"]);
          print(["    <string>", "d"], [f.href, "c"], ["</string>", "d"]);
          print(["</dict>", "d"]);
          print(["</plist>", "d"]);
        }
      });
    },

    // Like macOS: open a website shortcut (.webloc) or a URL in the browser.
    // On a real Mac, opening a text file would launch a text editor, so here it points you to cat.
    open(args) {
      const targets = args.filter((a) => !a.startsWith("-"));
      if (!targets.length) return print(["Usage: open <file.webloc>", "r"], ["   (try: open linkedin.webloc)", "d"]);
      targets.forEach((t) => {
        if (/^https?:\/\//i.test(t)) {
          window.open(t, "_blank", "noopener");
          return print(["Opening " + t.replace(/^https?:\/\//i, "") + " in a new tab\u2026", "d"]);
        }
        const r = resolve(t);
        if (r.outside || (!isDir(r.key) && !isFile(r.key))) return err("The file " + (r.outside || abs(r.key)) + " does not exist.");
        if (isDir(r.key)) return print(["open: " + t + " is a folder. Use: ", "y"], ["cd " + t, "g"]);
        const f = FILES[r.key];
        if (f.kind === "webloc") {
          window.open(f.href, "_blank", "noopener");
          return print(["Opening " + f.label + " in a new tab\u2026", "d"]);
        }
        print(["open: " + t + " is a text file. Use: ", "y"], ["cat " + t, "g"]);
      });
    },

    pwd() { print(abs(cwd)); },
    whoami() { print(USER); },
    hostname() { print(HOST); },
    neofetch() { printTpl("neofetch"); },
    clear() { out.textContent = ""; },
    history() {
      const h = store.get("history", []);
      h.forEach((c, i) => print([String(i + 1).padStart(5), "d"], "  ", c));
    },
    echo(args) { print(args.join(" ").replace(/^["']|["']$/g, "")); },
    date() {
      const d = new Date();
      const tz = (d.toTimeString().match(/\(([^)]+)\)/) || [])[1] || "";
      const short = tz.split(" ").map((w) => w[0]).join("");
      const parts = d.toString().split(" ");   // Tue Oct 20 2026 17:35:00 GMT-0500 (...)
      print(parts[0] + " " + parts[1] + " " + String(d.getDate()).padStart(2) + " " + parts[4] + " " + short + " " + parts[3]);
    },
    man(args) {
      const name = (args[0] || "").toLowerCase();
      if (!name) return print("What manual page do you want?");
      const row = HELP.find(([c]) => c.split(" ")[0] === name) || SHORTCUTS.find(([c]) => c === name);
      if (!row) return print("No manual entry for " + name);
      print([name.toUpperCase() + "(1)", "b"]);
      print("");
      print(["NAME", "b"]);
      print("     " + name + " – " + row[1]);
      print(["SYNOPSIS", "b"]);
      print("     ", [row[0], "g"]);
    },
    git(args) {
      const repo = repoFor(cwd);
      if (!repo) return err("fatal: not a git repository (or any of the parent directories): .git");
      if (args[0] === "status") { print("On branch main"); return print("nothing to commit, working tree clean"); }
      if (args[0] === "log") return COMMANDS.github();
      print("usage: git status | git log", ["   (or type github to see the repo)", "d"]);
    },
    sudo() { print("Sorry, user " + USER + " may not run sudo on " + HOST + "."); },
    exit() {
      print("logout");
      print("");
      print("[Process completed]");
      line.classList.add("off");
      input.disabled = true;
      input.blur();
      const restart = () => { location.href = "/"; };
      setTimeout(() => {
        document.addEventListener("keydown", restart, { once: true });
        document.addEventListener("click", restart, { once: true });
      }, 50);
    },

    // shortcuts
    about() { COMMANDS.cat(["~/about.txt"]); },
    experience() { COMMANDS.cat(["~/experience.txt"]); },
    education() { COMMANDS.cat(["~/education.txt"]); },
    skills() { COMMANDS.cat(["~/skills.txt"]); },
    projects() { COMMANDS.cd(["~/projects"]); },
    home() { COMMANDS.cd(["~"]); },
    linkedin() { COMMANDS.open(["~/linkedin.webloc"]); },
    github() { COMMANDS.open([repoFor(cwd) ? "github.webloc" : "~/github.webloc"]); },
  };
  COMMANDS.logout = COMMANDS.exit;
  COMMANDS.cls = COMMANDS.clear;
  COMMANDS.dir = COMMANDS.ls;
  COMMANDS.type = COMMANDS.cat;
  COMMANDS.more = COMMANDS.cat;
  COMMANDS.less = COMMANDS.cat;
  COMMANDS.ll = (args) => COMMANDS.ls(["-l"].concat(args));
  const COMMAND_NAMES = ["cat", "cd", "clear", "echo", "date", "exit", "git", "help", "history", "ls", "man", "neofetch", "open", "pwd", "whoami",
    "about", "experience", "education", "skills", "projects", "linkedin", "github"];

  // ---------------------------------------------------------------- running a line
  function tokenize(text) {
    const toks = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(text))) toks.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    return toks;
  }

  function run(raw, opts) {
    const text = raw.trim();
    if (!(opts && opts.silent)) echo(cwd, raw);
    if (!text) return;
    if (!(opts && opts.noHistory)) {
      const h = store.get("history", []);
      h.push(text);
      store.set("history", h.slice(-200));
    }
    // allow "a && b" / "a; b"
    const parts = text.split(/\s*(?:&&|;)\s*/).filter(Boolean);
    for (const part of parts) {
      if (input.disabled) break;
      runOne(part, text);
    }
  }

  function runOne(text, typed) {
    const toks = tokenize(text);
    const name = toks[0];
    const key = name.toLowerCase();
    const args = toks.slice(1);
    if (Object.prototype.hasOwnProperty.call(COMMANDS, key)) return COMMANDS[key](args, typed);
    // zsh AUTO_CD: typing a directory name goes there
    const r = resolve(name);
    if (!r.outside && isDir(r.key) && !args.length) return COMMANDS.cd([name], typed);
    if (!r.outside && isFile(r.key)) return err("zsh: permission denied: " + name);
    err("zsh: command not found: " + name);
  }

  // ---------------------------------------------------------------- the input line
  let histPos = store.get("history", []).length;
  let draft = "";

  function render() {
    const v = input.value;
    const pos = input.selectionStart == null ? v.length : input.selectionStart;
    before.textContent = v.slice(0, pos);
    cur.textContent = v[pos] || " ";
    after.textContent = v.slice(pos + 1);
  }
  ["input", "keyup", "click", "select", "focus"].forEach((ev) => input.addEventListener(ev, () => setTimeout(render, 0)));
  input.addEventListener("focus", () => line.classList.add("focused"));
  input.addEventListener("blur", () => line.classList.remove("focused"));

  function setValue(v) {
    input.value = v;
    input.setSelectionRange(v.length, v.length);
    render();
  }

  function complete() {
    const v = input.value.slice(0, input.selectionStart);
    const rest = input.value.slice(input.selectionStart);
    const toks = v.split(/\s+/);
    const word = toks[toks.length - 1];
    let options;
    let prefix;
    let base = "";
    if (toks.length === 1) {
      prefix = word.toLowerCase();
      options = COMMAND_NAMES.filter((c) => c.startsWith(prefix)).map((c) => ({ name: c, dir: false }));
    } else {
      const slash = word.lastIndexOf("/");
      base = slash >= 0 ? word.slice(0, slash + 1) : "";
      prefix = (slash >= 0 ? word.slice(slash + 1) : word).toLowerCase();
      const r = resolve(base || ".");
      if (r.outside || !isDir(r.key)) return;
      const cmd = toks[0].toLowerCase();
      options = DIRS[r.key]
        .map((n) => ({ name: n, dir: isDir(r.key + "/" + n) }))
        .filter((o) => o.name.toLowerCase().startsWith(prefix))
        .filter((o) => (cmd === "cd" ? o.dir : true));
    }
    if (!options.length) return;
    const head = v.slice(0, v.length - word.length);
    if (options.length === 1) {
      const o = options[0];
      return setValue(head + base + o.name + (o.dir ? "/" : " ") + rest);
    }
    // extend to the longest common prefix, then list the choices
    let common = options[0].name;
    options.forEach((o) => { while (!o.name.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1); });
    if (common.length > prefix.length) return setValue(head + base + common + rest);
    echo(cwd, input.value);
    const row = document.createElement("div");
    row.className = "cols";
    options.forEach((o) => row.append(span(o.name + (o.dir ? "/" : ""), o.dir ? "bl b" : "")));
    printNode(row);
    scrollToPrompt();
  }

  input.addEventListener("keydown", (e) => {
    const h = store.get("history", []);
    if (e.key === "Enter") {
      e.preventDefault();
      const v = input.value;
      setValue("");
      histPos = store.get("history", []).length + (v.trim() ? 1 : 0);
      draft = "";
      run(v);
      scrollToPrompt();
    } else if (e.key === "Tab") {
      e.preventDefault();
      complete();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histPos === h.length) draft = input.value;
      if (histPos > 0) setValue(h[--histPos]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histPos < h.length) { histPos++; setValue(histPos === h.length ? draft : h[histPos]); }
    } else if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      echo(cwd, input.value + "^C");
      setValue("");
      scrollToPrompt();
    } else if ((e.ctrlKey && (e.key === "l" || e.key === "L")) || (e.metaKey && (e.key === "k" || e.key === "K"))) {
      e.preventDefault();
      COMMANDS.clear();
    } else if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
      setValue("");
    }
  });

  // Click or tap anywhere to type (unless selecting text to copy)
  document.addEventListener("click", () => {
    if (input.disabled || String(window.getSelection())) return;
    input.focus({ preventScroll: true });
    scrollToPrompt();
  });
  // Typing anywhere goes to the prompt
  document.addEventListener("keydown", (e) => {
    if (input.disabled || document.activeElement === input || e.metaKey || e.altKey) return;
    if (e.key.length === 1 || e.key === "Tab" || e.key === "ArrowUp") {
      input.focus({ preventScroll: true });
      scrollToPrompt();
    }
  });

  // ---------------------------------------------------------------- start up
  function lastLogin() {
    const d = new Date();
    const parts = d.toString().split(" ");
    print(["Last login: " + parts[0] + " " + parts[1] + " " + String(d.getDate()).padStart(2) + " " + parts[4] + " on ttys000", ""]);
  }

  function start() {
    lastLogin();
    // Open in the directory the address points to (/projects/... links can be shared)
    const path = decodeURIComponent(location.pathname).replace(/\/index\.html$/i, "/").replace(/\/+$/, "") || "/";
    const dir = Object.keys(URLS).find((k) => URLS[k].toLowerCase() === path.toLowerCase());
    if (dir) setCwd(dir);
    else {
      setCwd("~");
      err("zsh: no such file or directory: " + path);
    }
    line.classList.remove("off");
    if (window.matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
    render();
  }

  start();
})();
