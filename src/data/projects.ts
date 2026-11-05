// Every project on the site, newest first within each tier. The Work page
// (/repositories/) lists them in three tiers; each one also needs a page at
// src/pages/repositories/<slug>.astro (copy one of those; the page's header,
// facts and README come from here).

export interface Project {
  slug: string;              // the page's address: /repositories/<slug>
  name: string;
  tagline: string;           // one line: the archive list, and the page's dek when there's no question
  summary: string;           // the page's opening paragraph
  description?: string;      // search and link-preview text (defaults to "<name>: <summary>")
  repo: string;              // "owner/name" on GitHub
  chips: string[];           // the stack, in the page's facts
  when: { start: string; end?: string };   // "2021", "2020-12"; end "present" for ongoing
  readme: boolean;           // offer the repo's README ("From the repo") on the page
  kind: string;              // the label above the headline: "Web app", "Research", "Coursework"
  status: string;            // "In progress", "Live", "Published", "Finished"
  tier: "featured" | "more" | "archive";   // where the Work page lists it
  headline?: string;         // a featured project's headline, after its name
  preview?: string;          // alt text for its own link-preview image, public/repositories/<slug>.jpg (made by scripts/link-previews.mjs)
  question?: string;         // the question the project answers, under the headline
  app?: { label: string; href: string };       // the live app
  writeup?: { label: string; href: string };   // the research write-up
}

export const projects: Project[] = [
  {
    slug: "open-tradesman",
    preview: "Open Tradesman: Talk through the job in your language. The customer gets a priced estimate in theirs.",
    name: "Open Tradesman",
    tagline: "Talk through a job, send a priced estimate, get paid",
    summary: "A voice-first estimating app for tradespeople, built for the PayPal AI Hackathon. The tradesperson talks through the job in their own language; Claude turns it into an itemized, priced estimate in the customer's language; and PayPal invoicing handles the money, from the deposit and change orders to the final invoice.",
    description: "Open Tradesman: a voice-first estimating app for tradespeople, built for the PayPal AI Hackathon. Claude turns a spoken job description into a priced estimate in the customer's language, and PayPal invoicing handles the money.",
    repo: "amkashyap1220/Open-Tradesman",
    chips: ["React PWA", "FastAPI", "Claude API", "PayPal Invoicing API", "Postgres"],
    when: { start: "2026-11", end: "present" },
    readme: true,
    kind: "Hackathon", status: "In progress", tier: "featured",
    headline: "Talk through the job in your language. The customer gets a priced estimate in theirs.",
    question: "Can the AI do the tedious part of quoting a job, while every price and every payment stays in the tradesperson’s hands?",
  },
  {
    slug: "bowling-ball-finder",
    name: "Bowling Ball Finder",
    tagline: "The next ball for your arsenal",
    summary: "A web app for serious bowlers: describe how you bowl (in plain words, or by filming a shot), list the balls you already own, and get recommendations for the reaction your arsenal is missing. Private for now, for a small group of testers.",
    description: "Bowling Ball Finder: a web app that recommends bowling balls from how you bowl, where you bowl and the balls you already own. Astro, Svelte, Cloudflare Workers and D1.",
    repo: "amkashyap1220/BowlingBallFinder",
    chips: ["Astro", "Svelte", "Cloudflare Workers", "Cloudflare D1", "Cloudflare Access"],
    when: {"start": "2026", "end": "present"},
    readme: true,
    kind: "Web app", status: "Private beta", tier: "more",
    app: { label: "Open the app (testers only)", href: "https://bowling.alexanderk.dev" },
  },
  {
    slug: "pa-job-market",
    name: "PA Job Market",
    tagline: "The physician assistant job market, for new grads",
    summary: "A data project for PAs about to graduate: which specialties hire new grads and what they pay, where PAs are, where pay goes furthest after the cost of living, and what the job search and debt look like, built from NCCPA's yearly workforce reports and BLS pay and job data.",
    description: "PA Job Market: charts and an interactive US map of the physician assistant job market for new grads, built with Python and pandas from NCCPA's workforce reports and BLS data.",
    repo: "amkashyap1220/PhysiciansAssistantJobExploration",
    chips: ["Python", "pandas", "NCCPA data", "BLS data", "Observable Plot", "Svelte"],
    when: {"start": "2026"},
    readme: true,
    kind: "Research", status: "Published", tier: "more",
    writeup: { label: "See the charts", href: "/lab/pa-job-market" },
  },
  {
    slug: "home-value-score",
    name: "Home Value Score",
    tagline: "Best-value zip codes in the Chicago metro",
    summary: "Every Chicago-area zip code scored on schools, safety, commute, train access, walkability, home age and price or rent. Readers set their own weights and targets, alone or with a partner, and a map shows their best-value areas.",
    description: "Home Value Score: an interactive map that ranks Chicago-area zip codes by value for buyers and renters, with your own weights and targets. Python, pandas and public data.",
    repo: "amkashyap1220/Home-Value-Score",
    chips: ["Python", "pandas", "GeoPandas", "statsmodels", "DuckDB", "Census data", "Observable Plot"],
    when: {"start": "2026"},
    readme: true,
    kind: "Research", status: "Published", tier: "featured",
    headline: "Where is the best value in Chicagoland?",
    question: "If you decide what matters to you, which Chicago-area zip codes fit best, and which cost less than they should?",
    writeup: { label: "Explore the map", href: "/lab/chicago-home-value" },
  },
  {
    slug: "switch-to-youtube",
    name: "Switch To YouTube",
    tagline: "Spotify → YouTube Music, free",
    summary: "A free, open-source web app that moves your Spotify liked songs and playlists to YouTube Music, as an alternative to paid migration services.",
    repo: "amkashyap1220/SwitchToYoutube",
    chips: ["Python", "Flask", "Spotify API", "YouTube Music API", "Docker"],
    when: {"start": "2023", "end": "present"},
    readme: true,
    kind: "Web app", status: "Open source", tier: "more",
  },
  {
    slug: "alexanderk-dev",
    preview: "A static site that keeps its own numbers fresh: how alexanderk.dev is built",
    name: "alexanderk.dev",
    tagline: "This website",
    summary: "This website. Built with Astro into plain HTML, CSS and JavaScript, and hosted on Cloudflare.",
    repo: "amkashyap1220/alexanderk.dev",
    chips: ["Astro", "HTML", "CSS", "JavaScript", "GitHub API", "Cloudflare"],
    when: {"start": "2026", "end": "present"},
    readme: true,
    kind: "This site", status: "Live", tier: "featured",
    headline: "A static site that keeps its own numbers fresh",
    question: "Can a static site stay current, and prove every page works, without a server to look after?",
  },
  {
    slug: "dotnet",
    name: "Personal Site (.NET)",
    tagline: "ASP.NET Core + React",
    summary: "An earlier version of my personal site: a React front end served by an ASP.NET Core (.NET 9) API on Azure, with an AI chat widget that answers questions about me.",
    repo: "amkashyap1220/dotNET",
    chips: ["C#", "ASP.NET Core", "React", "Azure SQL", "OpenAI API"],
    when: {"start": "2025"},
    readme: true,
    kind: "Web app", status: "Retired", tier: "archive",
  },
  {
    slug: "atg-shop",
    name: "ATG Shop",
    tagline: "CSCI 466 final project",
    summary: "An online hardware store on a MySQL database, built as a group project for my databases course (CSCI 466): product list, cart, checkout, order tracking, and an employee view.",
    repo: "amkashyap1220/466FinalProject",
    chips: ["PHP", "MySQL", "SQL", "Database design"],
    when: {"start": "2021"},
    readme: true,
    kind: "Course project", status: "Finished", tier: "archive",
  },
  {
    slug: "csci-241",
    name: "CSCI 241: Intermediate Programming",
    tagline: "Data structures and algorithms in C++",
    summary: "C++ assignments from CSCI 241 at NIU in spring 2021: sorting, recursion, stacks, linked lists, a binary search tree, and a small machine-language simulator and compiler.",
    repo: "amkashyap1220/CSCI-241-Intermediate-Programming",
    chips: ["C++", "Data structures", "Algorithms"],
    when: {"start": "2021"},
    readme: false,
    kind: "Coursework", status: "Finished", tier: "archive",
  },
  {
    slug: "csci-330",
    name: "CSCI 330: UNIX & Network Programming",
    tagline: "System calls, scripts, and sockets",
    summary: "Assignments from CSCI 330 at NIU in spring 2021: UNIX system calls in C++, fork and pipes, Bash and awk scripts, and a TCP file server.",
    repo: "amkashyap1220/CSCI-330-UNIX-and-Network-Programming",
    chips: ["C++", "Bash", "awk", "Sockets"],
    when: {"start": "2021"},
    readme: false,
    kind: "Coursework", status: "Finished", tier: "archive",
  },
  {
    slug: "csci-240",
    name: "CSCI 240: C++ Programs",
    tagline: "Programs 0–10, with video walkthroughs",
    summary: "Every programming assignment from NIU's intro C++ course (CSCI 240), Programs 0–10. I tested out of the course but did them all for practice, later TA'd it, and made video walkthroughs to help students.",
    repo: "amkashyap1220/CSCI-240-Computer-Programming-in-Cpp",
    chips: ["C++", "Teaching", "Video walkthroughs"],
    when: {"start": "2020-12", "end": "2021-02"},
    readme: true,
    kind: "Coursework", status: "Finished", tier: "archive",
  },
  {
    slug: "gaps-between-the-primes",
    name: "Gaps Between the Primes",
    tagline: "Prime gaps, by brute force",
    summary: "A small C++ program that walks the integers, finds each prime, and tracks the largest and smallest gap between consecutive primes.",
    repo: "amkashyap1220/Gaps-Between-The-Primes",
    chips: ["C++", "Number theory", "Algorithms"],
    when: {"start": "2020"},
    readme: true,
    kind: "Program", status: "Finished", tier: "archive",
  },
  {
    slug: "ratewillbot",
    name: "RateWillBot",
    tagline: "Memes, rated",
    summary: "A small Discord bot that rates a friend's memes from 1 to 9, with a comment to match, whenever he posts one.",
    repo: "amkashyap1220/RateWillBot",
    chips: ["Python", "discord.py"],
    when: {"start": "2020"},
    readme: true,
    kind: "Discord bot", status: "Finished", tier: "archive",
  },
  {
    slug: "college-experience",
    name: "College Experience",
    tagline: "Survive 8 semesters",
    summary: "An Android game about surviving college: each month you choose how to spend your time and try to keep your money, sanity, grades and health up until you graduate.",
    repo: "kashyap6/CollegeExperience",
    chips: ["Java", "Android", "Game"],
    when: {"start": "2020"},
    readme: false,
    kind: "Android game", status: "Finished", tier: "archive",
  },
  {
    slug: "cnit-255",
    name: "CNIT 255: Java Labs",
    tagline: "My first college programming class",
    summary: "Java labs from CNIT 255 at Purdue in spring 2019, my first college programming class: string handling, multi-class programs, a chat system, Swing GUIs, and inheritance.",
    repo: "amkashyap1220/CNIT-255-Kashyap",
    chips: ["Java", "Swing", "OOP"],
    when: {"start": "2019"},
    readme: false,
    kind: "Coursework", status: "Finished", tier: "archive",
  },
  {
    slug: "cosmishapes",
    name: "CosmiShapes",
    tagline: "A Unity game made in high school",
    summary: "A 3D shooter I made in Unity with two classmates in high school: survive each level, earn points, upgrade your stats, and beat the boss.",
    repo: "amkashyap1220/CosmiShapesFinal",
    chips: ["Unity", "C#", "Game"],
    when: {"start": "2018"},
    readme: false,
    kind: "Unity game", status: "Finished", tier: "archive",
  },
];

// "2021", "2020–21", "2023–now": the Work page's lists and the homepage archive
export function years({ start, end }: Project["when"]): string {
  const from = start.slice(0, 4);
  if (end === "present") return `${from}–now`;
  const to = end?.slice(0, 4);
  return !to || to === from ? from : `${from}–${to.slice(2)}`;
}

// "Nov 2026 – now", "Dec 2020 – Feb 2021", "2021": a project page's facts
export function dates({ start, end }: Project["when"]): string {
  const month = (d: string) => d.length > 4
    ? new Date(d + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : d;
  if (end === "present") return `${month(start)} – now`;
  return end && end !== start ? `${month(start)} – ${month(end)}` : month(start);
}

export function project(slug: string): Project {
  const p = projects.find((x) => x.slug === slug);
  if (!p) throw new Error("No project " + slug + " in src/data/projects.ts");
  return p;
}
