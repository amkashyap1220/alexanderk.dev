"""Saves the site's GitHub numbers to data/github.json.

Run by .github/workflows/github-data.yml. The site reads this file instead of
calling GitHub from every visitor's browser, so visitors never hit GitHub's
60-requests-an-hour limit. Anything missing from the file is still fetched
live (see js/gh.js), so a brand-new project works before the next run.

Keys match the cache keys in js/gh.js, and each value has the same shape the
browser code builds, so the browser can use it as is.
"""

import json
import os
import pathlib
import re
import sys
import urllib.request

USER = "amkashyap1220"
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "github.json"
API = "https://api.github.com/"
TOKEN = os.environ.get("GITHUB_TOKEN")


def get(path, accept="application/vnd.github+json"):
    headers = {"Accept": accept, "User-Agent": "alexanderk.dev"}
    if TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    with urllib.request.urlopen(urllib.request.Request(API + path, headers=headers), timeout=30) as res:
        return res.read().decode(), res.headers.get("Link") or ""


def get_json(path):
    return json.loads(get(path)[0])


def commit_count(name):
    # 1 commit per page: the last page number is the total
    body, link = get(f"repos/{name}/commits?per_page=1")
    last = re.search(r'[?&]page=(\d+)>; rel="last"', link)
    return int(last.group(1)) if last else len(json.loads(body))


def site_repos(attr):
    """Every owner/repo named in a data-gh or data-readme attribute on the site."""
    found = set()
    for page in ROOT.rglob("*.html"):
        found.update(re.findall(attr + r'="([^"/]+/[^"]+)"', page.read_text(encoding="utf-8")))
    return found


def main():
    data = {}
    failed = []

    def save(key, fetch):
        try:
            data[key.lower()] = fetch()
        except Exception as e:   # one failed lookup shouldn't lose the rest
            failed.append(f"{key}: {e}")   # left out, so the site fetches it live

    save(f"user:{USER}", lambda: {"since": get_json(f"users/{USER}")["created_at"]})

    # Forks are skipped: they're mostly other people's code
    save(f"repos:{USER}", lambda: [
        {"name": r["name"], "fullName": r["full_name"], "url": r["html_url"],
         "stars": r["stargazers_count"], "pushed": r["pushed_at"]}
        for r in get_json(f"users/{USER}/repos?per_page=100&type=owner") if not r["fork"]])
    own = data.get(f"repos:{USER}".lower(), [])

    def events():
        out = []
        for page in (1, 2, 3):   # public events only go back 90 days, 300 at most
            batch = get_json(f"users/{USER}/events/public?per_page=100&page={page}")
            out += [{"type": e["type"], "repo": e["repo"]["name"], "at": e["created_at"],
                     "ref": (e.get("payload") or {}).get("ref")} for e in batch]
            if len(batch) < 100:
                break
        return out
    save(f"events:{USER}", events)

    for name in sorted({r["fullName"] for r in own} | site_repos("data-gh")):
        save(f"commits:{name}", lambda: commit_count(name))
        save(f"languages:{name}", lambda: get_json(f"repos/{name}/languages"))

        def repo():
            info = get_json(f"repos/{name}")
            return {"stars": info["stargazers_count"], "language": info["language"],
                    "pushed": info["pushed_at"], "commits": data[f"commits:{name}".lower()]}
        save(f"repo:{name}", repo)

    for name in sorted(site_repos("data-readme")):
        save(f"readme:{name}", lambda: get(f"repos/{name}/readme", "application/vnd.github.html+json")[0])

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Saved {len(data)} entries to {OUT.relative_to(ROOT)}")
    for line in failed:
        print("Skipped", line, file=sys.stderr)


if __name__ == "__main__":
    main()
