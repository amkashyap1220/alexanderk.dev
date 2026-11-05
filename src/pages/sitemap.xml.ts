// /sitemap.xml: every public page, for search engines (robots.txt points here).
// Built from the same data as the pages; the private section, /unlock and the
// 404 page are left out. The tests check it lists exactly the pages that have
// a link preview (the public ones).
import { projects } from "../data/projects";
import { posts } from "../data/research";
import { site } from "../data/person";

export function GET() {
  const pages: { path: string; lastmod?: string }[] = [
    { path: "/" },
    { path: "/about" },
    { path: "/projects/" },
    ...projects.map((p) => ({ path: `/projects/${p.slug}` })),
    { path: "/research/" },
    ...posts.map((p) => ({ path: `/research/${p.slug}`, lastmod: p.updated ?? p.date })),
    { path: "/stats/" },
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${site}${p.path}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
