"""Generates index.html: one full-tab terminal page.
All "file contents" (resume.txt, each project's README.txt, the projects table)
are <template> tags that js/terminal.js prints when you cat a file.

Usage:  python tools/build_pages.py .
"""
import os, sys
from html import escape

SITE = sys.argv[1] if len(sys.argv) > 1 else "."
STY = "amkashyap1220/SwitchToYoutube"
SITE_REPO = "amkashyap1220/alexanderk.dev"

KNIGHT = """<svg viewBox="0 0 16 13" shape-rendering="crispEdges" aria-hidden="true"><path class="plume" d="M8 0h3v1H8zM7 1h3v1H7z"/><path d="M5 2h6v1H5zM4 3h8v1H4zM3 4h10v2H3zM3 6h2v1H3zM7 6h2v1H7zM11 6h2v1h-2zM3 7h10v2H3zM3 9h6v1H3zM10 9h1v1h-1zM12 9h1v1h-1zM3 10h10v1H3zM4 11h8v1H4zM2 12h12v1H2z"/></svg>"""


def gh(repo, field, cls=""):
    c = f' class="{cls}"' if cls else ""
    return f'<span data-gh="{repo}" data-field="{field}"{c}>--</span>'


def doc(filename, inner):
    """A file shown by cat: a bat-style header bar, then the nicely formatted contents."""
    return f"""<article class="doc">
<header class="doc-bar"><span><span class="d">File:</span> <span class="w b">{filename}</span></span><span class="d doc-size"></span></header>
<div class="doc-body">
{inner}
</div>
</article>"""


def sec(title, inner, color="y"):
    return f"""<section class="doc-sec">
<h2 class="{color}">{title}</h2>
{inner}
</section>"""


def bullets(items):
    return '<ul class="ticks">' + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def chips(items, color=""):
    return '<div class="chips">' + "".join(f'<span class="chip {color}">{i}</span>' for i in items) + "</div>"


# ------------------------------------------------------------------ resume.txt
# Matches the real resume, section for section. Phone and email are redacted on purpose.
JOBS = [
    ("Application Developer", "K-Rise Systems", "Aurora, IL · Enterprise software company", "January 2025 – Present", True, [
        "Worked on the rebuild of the company's AP Automation application for JD Edwards (primary project) in C# and .NET, adding new AI features and updates across the invoice pipeline, from scanned capture through validation and into JDE vouchers",
        "Help implement AP Automation for clients, gathering requirements from their finance teams, customizing the solution to fit their workflows, and carrying improvements back into the base product",
        "Wrote SQL to insert and update JD Edwards tables as invoices flowed through the pipeline, keeping accounts payable data accurate and in sync between systems",
        "Built AP Automation reports and dashboards, writing the SQL queries and building the report pages in JavaScript and CSS to give clients visibility into automation performance and their invoice data",
        "Integrated AI APIs to match addresses extracted from scanned invoices against address records in the database, reducing manual lookup",
        "Supported development of EASYPay and EASYCommerce, the company's .NET payments and e-commerce applications, including SQL to keep payment and order data in sync with JD Edwards",
    ]),
    ("AI Evaluator (Contract)", "Outlier, a Scale AI platform", "Remote", "May 2024 – January 2025", False, [
        "Evaluated and compared AI-generated code for correctness, clarity, and quality, writing feedback used as training data to improve large language models",
        "Applied detailed scoring rubrics consistently to coding tasks, flagging bugs and logical errors",
    ]),
    ("Software Engineering Intern – Middleware", "Chamberlain Group", "Chicago, IL", "May 2022 – January 2023", False, [
        "Built RESTful API endpoints in .NET 6 for the myQ connected-device platform",
        "Helped migrate services from .NET Core 3.1 to .NET 6, improving performance and maintainability in an Agile/Scrum team",
    ]),
]

PROJECTS_ON_RESUME = [
    ("Switch To YouTube", "Open-source", '<span class="c">github.com/amkashyap1220/SwitchToYoutube</span>', "August 2023 – 2024", False, [
        "Built a free, open-source tool that uses the Spotify and YouTube Music APIs to transfer users' playlists between platforms, as an alternative to paid migration services",
    ]),
    ("ATG Shop", "Databases course (CSCI 466)", "", "August 2023 – December 2023", False, [
        "Designed a normalized relational schema in MySQL for inventory, orders, and customers, and wrote the SQL behind order tracking and inventory management",
        "Built the full web application on the LAMP stack for store owners and customers",
    ]),
]


def timeline(items, sep="@"):
    rows = []
    for role, org, where, when, now, pts in items:
        rows.append(f"""<div class="tl-item{' now' if now else ''}">
<div class="tl-when">{when}</div>
<div class="tl-what">
<div><span class="role">{role}</span> <span class="d">{sep}</span> <span class="org">{org}</span></div>
{f'<div class="where">{where}</div>' if where else ''}
{bullets(pts) if pts else ""}
</div>
</div>""")
    return '<div class="timeline">' + "\n".join(rows) + "</div>"


SKILLS = [
    ("languages", ["SQL", "Python", "C#", "JavaScript/TypeScript", "C++"], "c"),
    ("databases", ["Microsoft SQL Server (T-SQL, SSMS)", "MySQL", "NoSQL"], "g"),
    ("frameworks &amp; tools", [".NET / .NET Core", "REST APIs", "Git", "Jira"], "m"),
    ("cloud", ["AWS", "Azure"], "bl"),
    ("enterprise systems", ["JD Edwards (ERP)"], "r"),
    ("certifications", ["AWS Certified Cloud Practitioner (May 2024)"], "y"),
]

REDACTED = '<span class="redact" title="redacted">redacted</span>'

resume = doc("resume.txt", "\n".join([
    f"""<div class="hero">
<h1>Alexander Kashyap</h1>
<p class="contact"><span>Chicago, IL Area</span><span class="sep">|</span><span>{REDACTED}</span><span class="sep">|</span><span>{REDACTED}</span><span class="sep">|</span><span class="c">linkedin.com/in/alexander-kashyap</span><span class="sep">|</span><span class="c">alexanderk.dev</span></p>
</div>""",
    sec("Summary", "<p>Software developer with ~2 years of experience building data-driven enterprise systems in C#, .NET, SQL, and Python. Comfortable working across the stack, from database design to API integrations, and skilled at turning business requirements into reliable solutions. Detail-oriented, quick to learn, and focused on building systems people can depend on.</p>", "c"),
    sec("Experience", timeline(JOBS), "y"),
    sec("Projects", timeline(PROJECTS_ON_RESUME, sep="|"), "g"),
    sec("Education", timeline([("Bachelor of Science in Computer Science", "Northern Illinois University", "", "May 2024", False, [
        "Relevant coursework: Databases, Probability &amp; Statistics, Data Structures, Algorithms, Software Engineering",
        "Scholarship player, NIU Esports",
        "Event Coordinator / Board Member, Association for Computing Machinery (ACM)",
        "Transfer Merit Scholar",
    ])]), "m"),
    sec("Skills &amp; Certifications", '<div class="skills">' + "".join(
        f'<div class="skill-label">{label}</div>{chips(items, color)}' for label, items, color in SKILLS) + "</div>", "bl"),
]))


# ------------------------------------------------------------------ project READMEs
def stats(repo):
    return f"""<div class="stats">
<span class="stat"><span class="y">★ {gh(repo, "stars")}</span> <span class="d">stars</span></span>
<span class="stat"><span class="g">{gh(repo, "commits")}</span> <span class="d">commits</span></span>
<span class="stat"><span class="m">{gh(repo, "language")}</span></span>
<span class="stat"><span class="d">updated</span> {gh(repo, "updated")}</span>
</div>"""


def readme(name, blurb, repo, stack, sections):
    return doc("README.txt", "\n".join([
        f"""<div class="hero">
<h1>{name}</h1>
<p class="tagline">{blurb}</p>
</div>""",
        stats(repo),
        chips(stack, "c"),
        f'<p class="meta"><span>↗ source: <span class="g">open github.webloc</span></span></p>',
    ] + sections))


TODO = lambda what: f'<div class="callout"><span class="y b">TODO</span> &nbsp;A full walkthrough of how {what} is coming soon.</div>'

readme_sty = readme(
    "Switch To YouTube",
    "A free, open-source web app that moves your Spotify liked songs and playlists to YouTube Music.",
    STY, ["Python", "Flask", "Spotify API (spotipy)", "YouTube Music API (ytmusicapi)", "Docker"],
    [
        sec("What it is", """<p>Switch To YouTube is a small Flask web app. You sign in to Spotify and YouTube Music, pick your liked songs and the playlists you want, and it rebuilds them on YouTube Music.</p>
<ol class="steps">
<li>Sign in to both services.</li>
<li>Choose your liked songs and/or playlists.</li>
<li>For each song, the app searches YouTube Music and picks the closest match by title, artist, and length.</li>
<li>Liked songs get liked on YouTube Music, and each playlist is recreated with the same name.</li>
<li>At the end, it shows how many songs were found and lists any it couldn't match.</li>
</ol>""", "c"),
        sec("Why I made it", "<p>Every tool I could find for moving playlists between services was paid. Moving playlists you already own shouldn't cost money, so I built a free, open-source option anyone can use.</p>", "m"),
        sec("Screenshots", f"""<!-- Temporary placeholder: replace with <img src="/screenshots/switch-to-youtube-1.png" alt="..."> once real screenshots are in -->
<div class="shots"><div class="no-image">{KNIGHT}<span>no image yet</span></div></div>""", "g"),
        sec("How it works", "<!-- Your in-depth, teach-it-to-someone walkthrough goes here. -->\n" + TODO("this project works"), "y"),
    ])

readme_site = readme(
    "alexanderk.dev",
    "This website: my resume and projects, in a terminal you navigate by typing.",
    SITE_REPO, ["HTML", "CSS", "JavaScript", "GitHub API", "Cloudflare Workers"],
    [
        sec("What it is", """<p>A hand-built static site with no frameworks and no build step. It's a small zsh look-alike with a virtual filesystem: <span class="g">ls</span>, <span class="g">cd</span>, <span class="g">cat</span>, <span class="g">open</span>, tab completion and history, all on a single page. Project READMEs pull live star and commit counts from the GitHub API, and the site redeploys to Cloudflare automatically whenever I push to <span class="m">main</span>.</p>""", "c"),
        sec("Why I made it", "<p>I wanted one place to show my work, and to explain each project as if I were teaching it, because teaching something is the best way I know to really understand it.</p>", "m"),
        sec("How it works", "<!-- Your in-depth walkthrough goes here. -->\n" + TODO("this site is built"), "y"),
    ])


# ------------------------------------------------------------------ projects table (ls -l in ~/projects)
projects_table = """<div class="tbl"><table>
<thead><tr><th>name</th><th class="num">★ stars</th><th class="num">commits</th><th>language</th><th class="opt">about</th></tr></thead>
<tbody>
""" + "\n".join(
    f"""<tr><td><span class="bl b">{name}/</span></td><td class="num">{gh(repo, "stars", "y")}</td><td class="num">{gh(repo, "commits", "g")}</td><td>{gh(repo, "language", "m")}</td><td class="d opt">{about}</td></tr>"""
    for name, repo, about in [("switch-to-youtube", STY, "Spotify → YouTube Music"), ("alexanderk-dev", SITE_REPO, "this website")]
) + "\n</tbody></table></div>"

T = {
    "resume": resume,
    "readme-switch-to-youtube": readme_sty,
    "readme-alexanderk-dev": readme_site,
    "projects-table": projects_table,
}
TEMPLATES = "\n".join(f'<template id="tpl-{k}">\n{v}\n</template>' for k, v in T.items())


# ------------------------------------------------------------------ the page
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
