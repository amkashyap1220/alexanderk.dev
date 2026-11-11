// Every research post, newest first (the order the Research page lists them).
// Each one also needs a page at src/pages/lab/<slug>.astro: copy
// src/pages/lab/_template.astro (files starting with _ aren't pages).

export interface Post {
  slug: string;              // the page's address: /lab/<slug>
  title: string;
  date: string;              // "2026-10-21"
  updated?: string;          // shown as "Updated <date>" in the byline when set
  through?: string;          // how recent the data is, for the byline: "Data through <through>" (leave out for a game)
  featured?: boolean;        // the featured research on the Research page (one at a time)
  lead: string;              // the line under the title on the post
  summary: string;           // the Research page card text
  description: string;       // search and link-preview text
  chips: string[];
  // Preview image: public/lab/<slug>.png and <slug>-dark.png, 1200 x 630.
  // Used on the card and as the link preview; leave out for a card without one.
  image?: { alt: string; previewAlt?: string };
  link?: { label: string; href: string };   // a main button before "← All research"
}

export const posts: Post[] = [
  {
    slug: "royal-flux",
    title: "Royal Flux",
    date: "2026-11-11",
    lead: "A poker roguelike. Play hands to score chips times mult, beat the blinds, and build a deck and a row of charms that break the rules in your favor.",
    summary: "Royal Flux, an original poker roguelike deckbuilder, to play right here or install on your phone.",
    description: "Play Royal Flux, an original poker roguelike deckbuilder, in your browser on a phone or a computer. Install it to your home screen to play offline.",
    chips: ["Card game", "React", "TypeScript", "Cloudflare Workers"],
    image: {
      alt: "The game on a computer screen: a green felt table with five selected playing cards raised from a hand of eight, a Pair worth 10 chips times 2 mult, and a small blind asking for 300",
      previewAlt: "The Royal Flux card game on a computer screen, with a hand of playing cards on green felt",
    },
    link: { label: "Code", href: "https://github.com/amkashyap1220/BalatroClone" },
  },
  {
    slug: "scoundrel",
    title: "Scoundrel",
    date: "2026-11-05",
    featured: true,
    lead: "A solo dungeon crawler played with a deck of cards. Fight monsters, pick your weapons and potions carefully, and see how far you get.",
    summary: "Scoundrel, the solo card game, to play right here on a phone or a computer, with shared high scores.",
    description: "Play Scoundrel, the solo dungeon crawler played with a deck of cards, in your browser on a phone or a computer, with shared high scores.",
    chips: ["Card game", "Svelte", "Cloudflare Workers", "Cloudflare D1"],
    image: {
      alt: "The game on a computer screen: a health bar at 12 of 20 over a room of four storybook-style cards: a bearded King of spades holding a sword, the 7 of diamonds, a Queen of clubs drawn as a sorceress with a staff, and the 5 of hearts",
      previewAlt: "The Scoundrel card game on a computer screen, with a room of four storybook-style playing cards",
    },
    link: { label: "Code", href: "https://github.com/amkashyap1220/SimpleScoundrel" },
  },
  {
    slug: "pa-job-market",
    title: "The PA job market for new grads",
    date: "2026-10-30",
    through: "2025",
    lead: "What PA specialties hire new grads, what they pay, where PAs work and how long the job search takes, in charts.",
    summary: "A guide in charts for PAs about to graduate: which specialties hire new grads, pay by specialty, employer, state and city, the job search, and debt.",
    description: "Charts for graduating physician assistants: where new PAs take jobs, what each specialty and employer pays, pay after the cost of living by state and metro area, job growth, how long the job search takes, and how much debt new PAs carry. From NCCPA's latest reports and BLS data.",
    chips: ["Interactive map", "Python", "NCCPA data", "BLS data"],
    image: {
      alt: "Map of US metro areas as circles sized by PA jobs and shaded from light to dark blue by median PA pay after the cost of living",
      previewAlt: "Map of US metro areas sized by PA jobs and shaded by PA pay after the cost of living",
    },
    link: { label: "Data and code", href: "https://github.com/amkashyap1220/PhysiciansAssistantJobExploration" },
  },
  {
    slug: "chicago-home-value",
    title: "Where is the best value in Chicagoland?",
    date: "2026-10-21",
    updated: "2026-10-22",
    through: "May 2026",
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
