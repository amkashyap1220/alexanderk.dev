"""Writes the site's HTML pages, macOS Terminal version.
Every page is the same Terminal window; they differ only in which directory they represent.
All "file contents" are <template> tags included on every page."""
import os, sys
from html import escape

SITE = sys.argv[1]
STY = "amkashyap1220/SwitchToYoutube"
SITE_REPO = "amkashyap1220/alexanderk.dev"

KNIGHT = """<svg viewBox="0 0 16 13" shape-rendering="crispEdges" aria-hidden="true"><path class="plume" d="M8 0h3v1H8zM7 1h3v1H7z"/><path d="M5 2h6v1H5zM4 3h8v1H4zM3 4h10v2H3zM3 6h2v1H3zM7 6h2v1H7zM11 6h2v1h-2zM3 7h10v2H3zM3 9h6v1H3zM10 9h1v1h-1zM12 9h1v1h-1zM3 10h10v1H3zM4 11h8v1H4zM2 12h12v1H2z"/></svg>"""


def box(title, inner):
    return f'<div class="abox" data-title="{escape(title)}"><div class="body">\n{inner}\n</div></div>'


def gh(repo, field, width=0, cls=""):
    w = f' data-width="{width}"' if width else ""
    c = f' class="{cls}"' if cls else ""
    return f'<span data-gh="{repo}" data-field="{field}"{w}{c}>{"--".rjust(width) if width else "--"}</span>'


def job(role, company, where, when, bullets):
    lis = "\n".join(f"<li>{b}</li>" for b in bullets)
    return f"""<div class="job">
<div class="job-head"><span><span class="y b">{role}</span> <span class="d">@</span> <span class="c">{company}</span></span><span class="d">{when}</span></div>
<div class="d">{where}</div>
<ul class="dots">
{lis}
</ul>
</div>"""


# ------------------------------------------------------------------ file contents
T = {}

T["about"] = box("about.txt", """<div class="split">
<div>
<p class="w b">Alexander Kashyap</p>
<p>Software developer with ~2 years of experience building data-driven enterprise systems in C#, .NET, SQL, and Python.</p>
<div class="blank"></div>
<p>I like turning business requirements into reliable solutions, and explaining how things work.</p>
</div>
<dl class="kv">
<dt class="c">location</dt><dd>Chicago, IL area</dd>
<dt class="c">role</dt><dd>Application Developer</dd>
<dt class="c">experience</dt><dd>~2 years</dd>
<dt class="c">degree</dt><dd>B.S. Computer Science</dd>
<dt class="c">contact</dt><dd><span class="g">open linkedin.webloc</span></dd>
</dl>
</div>""")

T["experience"] = box("experience.txt", "\n".join([
    job("Application Developer", "K-Rise Systems", "Aurora, IL · Enterprise software", "Jan 2025 – Present", [
        "Worked on the rebuild of the company's AP Automation application for JD Edwards in C# and .NET, adding new AI features across the invoice pipeline, from scanned capture through validation and into JDE vouchers.",
        "Help implement AP Automation for clients: gathering requirements from their finance teams, customizing the solution to fit their workflows, and carrying improvements back into the base product.",
        "Wrote SQL to insert and update JD Edwards tables as invoices flowed through the pipeline, keeping accounts payable data accurate and in sync between systems.",
        "Built AP Automation reports and dashboards, writing the SQL queries and the report pages in JavaScript and CSS.",
        "Integrated AI APIs to match addresses extracted from scanned invoices against address records in the database.",
        "Supported development of EASYPay and EASYCommerce, the company's .NET payments and e-commerce applications.",
    ]),
    job("AI Evaluator (Contract)", "Outlier", "Remote · a Scale AI platform", "May 2024 – Jan 2025", [
        "Evaluated and compared AI-generated code for correctness, clarity, and quality, writing feedback used as training data for large language models.",
    ]),
    job("Software Engineering Intern", "Chamberlain Group", "Chicago, IL · Middleware", "May 2022 – Jan 2023", [
        "Built RESTful API endpoints in .NET 6 for the myQ connected-device platform.",
        "Helped migrate services from .NET Core 3.1 to .NET 6 in an Agile/Scrum team.",
    ]),
]))

T["education"] = box("education.txt", """<div class="job-head"><span><span class="y b">B.S. Computer Science</span> <span class="d">@</span> <span class="c">Northern Illinois University</span></span><span class="d">May 2024</span></div>
<ul class="dots">
<li>Coursework: Databases, Probability &amp; Statistics, Data Structures, Algorithms, Software Engineering</li>
<li>Scholarship player, NIU Esports</li>
<li>Event Coordinator / Board Member, Association for Computing Machinery (ACM)</li>
<li>Transfer Merit Scholar</li>
</ul>""")

T["skills"] = box("skills.txt", """<dl class="kv">
<dt class="bl b">languages</dt><dd>SQL, Python, C#, JavaScript/TypeScript, C++</dd>
<dt class="bl b">databases</dt><dd>Microsoft SQL Server (T-SQL, SSMS), MySQL</dd>
<dt class="bl b">frameworks</dt><dd>.NET / .NET Core, REST APIs</dd>
<dt class="bl b">tools</dt><dd>Git, Jira</dd>
<dt class="bl b">cloud</dt><dd>AWS, Azure</dd>
<dt class="bl b">enterprise</dt><dd>JD Edwards (ERP)</dd>
<dt class="bl b">certified</dt><dd>AWS Certified Cloud Practitioner (2024)</dd>
</dl>""")

ART = r"""    ___    __ __
   /   |  / //_/
  / /| | / ,<
 / ___ |/ /| |
/_/  |_/_/ |_|"""
T["neofetch"] = f"""<div class="neofetch">
<pre><span class="c b">{escape(ART)}</span></pre>
<div>
<p><span class="g b">alexander</span>@<span class="g b">alexanderk-dev</span></p>
<p class="d">------------------------</p>
<dl class="kv">
<dt class="y b">Name</dt><dd>Alexander Kashyap</dd>
<dt class="y b">Role</dt><dd>Application Developer</dd>
<dt class="y b">Company</dt><dd>K-Rise Systems</dd>
<dt class="y b">Location</dt><dd>Chicago, IL area</dd>
<dt class="y b">Uptime</dt><dd>~2 years professional</dd>
<dt class="y b">Languages</dt><dd>SQL, Python, C#, JavaScript, C++</dd>
<dt class="y b">Stack</dt><dd>.NET, SQL Server, REST APIs, AWS, Azure</dd>
<dt class="y b">Education</dt><dd>B.S. Computer Science, NIU</dd>
<dt class="y b">Shell</dt><dd>zsh</dd>
</dl>
<div class="swatches"><span style="background:#1e1e1e;outline:1px solid #444"></span><span style="background:var(--red)"></span><span style="background:var(--green)"></span><span style="background:var(--yellow)"></span><span style="background:var(--blue)"></span><span style="background:var(--magenta)"></span><span style="background:var(--cyan)"></span><span style="background:#e4e4e4"></span></div>
</div>
</div>"""


def projects_table():
    rows = "\n".join(f"""<tr><td><span class="bl b">{name}/</span></td><td class="num">{gh(repo, "stars", 0, "y")}</td><td class="num">{gh(repo, "commits", 0, "g")}</td><td>{gh(repo, "language", 0, "m")}</td><td class="d opt">{about}</td></tr>"""
                     for name, repo, about in [("switch-to-youtube", STY, "Spotify → YouTube Music"), ("alexanderk-dev", SITE_REPO, "this website")])
    return f"""<div class="tbl"><table>
<thead><tr><th>name</th><th class="num">★ stars</th><th class="num">commits</th><th>language</th><th class="opt">about</th></tr></thead>
<tbody>
{rows}
</tbody></table></div>"""


T["projects-table"] = projects_table()


def status(repo, blurb, stack):
    return box("README.md", f"""<p>{blurb}</p>
<div class="blank"></div>
<dl class="kv">
<dt class="c">stars</dt><dd><span class="y">★ </span>{gh(repo, "stars", 0, "y")}</dd>
<dt class="c">commits</dt><dd>{gh(repo, "commits", 0, "g")}</dd>
<dt class="c">language</dt><dd>{gh(repo, "language", 0, "m")}</dd>
<dt class="c">updated</dt><dd>{gh(repo, "updated")}</dd>
<dt class="c">stack</dt><dd><ul class="tags">{"".join(f"<li>{s}</li>" for s in stack)}</ul></dd>
<dt class="c">source</dt><dd><span class="g">open github.webloc</span></dd>
</dl>""")


def section(title, inner):
    return box(title, inner)


T["readme-switch-to-youtube"] = "\n".join([
    '<p class="m b"># Switch To YouTube</p>',
    status(STY, "A free, open-source web app that moves your Spotify liked songs and playlists to YouTube Music.",
           ["Python", "Flask", "Spotify API (spotipy)", "YouTube Music API (ytmusicapi)", "Docker"]),
    section("## What it is", """<p>Switch To YouTube is a small Flask web app. You sign in to Spotify and YouTube Music, pick your liked songs and the playlists you want, and it rebuilds them on YouTube Music.</p>
<div class="blank"></div>
<ol class="num">
<li>Sign in to both services.</li>
<li>Choose your liked songs and/or playlists.</li>
<li>For each song, the app searches YouTube Music and picks the closest match by title, artist, and length.</li>
<li>Liked songs get liked on YouTube Music, and each playlist is recreated with the same name.</li>
<li>At the end, it shows how many songs were found and lists any it couldn't match.</li>
</ol>"""),
    section("## Why I made it", "<p>Every tool I could find for moving playlists between services was paid. Moving playlists you already own shouldn't cost money, so I built a free, open-source option anyone can use.</p>"),
    section("## Screenshots", f"""<div class="shots">
<!-- Temporary placeholder: replace with <img src="/projects/switch-to-youtube/screenshot-1.png" alt="..."> once real screenshots are in -->
<div class="no-image">{KNIGHT}<span>no image yet</span></div>
</div>"""),
    section("## How it works", """<!-- Your in-depth, teach-it-to-someone walkthrough goes here. -->
<p><span class="y b">TODO:</span> a full walkthrough of how this project works is coming soon.</p>"""),
])

T["readme-alexanderk-dev"] = "\n".join([
    '<p class="m b"># alexanderk.dev</p>',
    status(SITE_REPO, "This website: my portfolio and project write-ups, running in a terminal you navigate by typing.",
           ["HTML", "CSS", "JavaScript", "GitHub API", "Cloudflare Workers"]),
    section("## What it is", "<p>A hand-built static site with no frameworks and no build step. It's a small zsh look-alike with a virtual filesystem: <span class=\"g\">ls</span>, <span class=\"g\">cd</span>, <span class=\"g\">cat</span>, <span class=\"g\">open</span>, tab completion and history. Project pages pull live star and commit counts from the GitHub API, and the whole site redeploys to Cloudflare automatically whenever I push to <span class=\"m\">main</span>.</p>"),
    section("## Why I made it", "<p>I wanted one place to show my work, and to explain each project as if I were teaching it, because teaching something is the best way I know to really understand it.</p>"),
    section("## How it works", """<!-- Your in-depth walkthrough goes here. -->
<p><span class="y b">TODO:</span> a full walkthrough of how this site is built is coming soon.</p>"""),
])

TEMPLATES = "\n".join(f'<template id="tpl-{k}">\n{v}\n</template>' for k, v in T.items())


# ------------------------------------------------------------------ the page (single page: the whole tab is the terminal)
def page(path, *, title, desc):
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#1e1e1e">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="scroll" tabindex="-1">
    <main class="term">
      <div class="out" aria-live="polite"></div>
      <form class="cmdline off" autocomplete="off" onsubmit="return false"><span class="ps"></span><span class="before"></span><span class="cur"> </span><span class="after"></span><input type="text" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="Terminal command"></form>
      <noscript><p>This site is a terminal and needs JavaScript to run.</p></noscript>
    </main>
  </div>

{TEMPLATES}

  <script src="/js/github.js"></script>
  <script src="/js/terminal.js"></script>
</body>
</html>
"""
    full = os.path.join(SITE, path)
    os.makedirs(os.path.dirname(full) or SITE, exist_ok=True)
    open(full, "w").write(html)


page("index.html", title="alexander@alexanderk-dev: ~",
     desc="Alexander Kashyap - software developer building data-driven enterprise systems in C#, .NET, SQL, and Python.")
print("built")
