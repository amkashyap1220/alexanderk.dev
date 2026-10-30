// Every research post, newest first (the order the Research page lists them).
// Each one also needs a page at src/pages/research/<slug>.astro: copy
// src/pages/research/_template.astro (files starting with _ aren't pages).

export interface Post {
  slug: string;              // the page's address: /research/<slug>
  title: string;
  date: string;              // "2026-10-21"
  updated?: string;          // shown as "· updated <date>" when set
  lead: string;              // the line under the title on the post
  summary: string;           // the Research page card text
  description: string;       // search and link-preview text
  chips: string[];
  // Preview image: public/research/<slug>.png and <slug>-dark.png, 1200 x 630.
  // Used on the card and as the link preview; leave out for a card without one.
  image?: { alt: string; previewAlt?: string };
  link?: { label: string; href: string };   // a main button before "← All research"
}

export const posts: Post[] = [
  {
    slug: "pa-job-market",
    title: "The PA job market for new grads",
    date: "2026-10-30",
    lead: "What PA specialties hire new grads, what they pay, where PAs work and how long the job search takes, in charts.",
    summary: "A guide in charts for PAs about to graduate: which specialties hire new grads, pay by specialty and state, the job search, and debt.",
    description: "Charts for graduating physician assistants: where new PAs take jobs, what each specialty pays, PAs and pay by state, how long the job search takes, and how much debt new PAs carry. From NCCPA's latest reports.",
    chips: ["Interactive map", "Python", "NCCPA data"],
    link: { label: "Data and code", href: "https://github.com/amkashyap1220/PhysiciansAssistantJobExploration" },
  },
  {
    slug: "chicago-home-value",
    title: "Where is the best value in Chicagoland?",
    date: "2026-10-21",
    updated: "2026-10-22",
    lead: "Say what you want in a place. The map scores every Chicago-area zip against it, and shows separately which zips sell for less, or more, than their measured features predict.",
    summary: "An interactive map of how well Chicago-area zip codes fit your own targets for buying or renting, and which sell for less or more than their measured features predict.",
    description: "Set your own targets and weights, for buying or renting, alone or with a partner, and see how every Chicago-area zip code fits on a map, and which sell for less or more than their measured features predict.",
    chips: ["Interactive map", "Python", "Census data"],
    image: {
      alt: "Map of Chicago-area zip codes colored from red (low score) to green (high score), with the 20 best-value zips outlined in blue",
      previewAlt: "Map of Chicago-area zip codes colored by value score, with the 20 best-value zips outlined",
    },
    link: { label: "Data and code", href: "https://github.com/amkashyap1220/Home-Value-Score" },
  },
];

export function post(slug: string): Post {
  const p = posts.find((x) => x.slug === slug);
  if (!p) throw new Error("No post " + slug + " in src/data/research.ts");
  return p;
}

// "2026-10-21" -> "Oct 21, 2026"
export const formatDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
