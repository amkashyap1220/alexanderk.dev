// Every page with the site header has the pieces the login relies on (run with: node --test tests/)
import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";

const pages = execSync("git ls-files '*.html'", { encoding: "utf8" }).split("\n").filter(Boolean)
  .filter((f) => fs.readFileSync(f, "utf8").includes('class="site-nav"'));

test("every page's header has the Private tab, the signed-in script and Log in", () => {
  assert.ok(pages.length > 10, "found the site's pages");
  for (const f of pages) {
    const html = fs.readFileSync(f, "utf8");
    assert.match(html, /<a class="nav-private" href="\/private\/"/, f + ": Private tab");
    assert.match(html, /<script src="\/js\/signed-in\.js"><\/script>/, f + ": signed-in.js");
    assert.match(html, /class="btn small login-link" href="\/login"/, f + ": Log in button");
  }
});
