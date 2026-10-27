// Every project on the site, in the order the Projects page lists them.
// Each one also needs a page at src/pages/projects/<slug>.astro (copy one
// of those; the hero, live GitHub numbers and README come from here).

export interface Project {
  slug: string;              // the page's address: /projects/<slug>
  name: string;
  tagline: string;
  summary: string;           // the page's lead, and the Projects card text
  description?: string;      // search and link-preview text (defaults to "<name>: <summary>")
  repo: string;              // "owner/name" on GitHub
  chips: string[];
  when: { start: string; end?: string };   // "2021", "2020-12"; end "present" for ongoing
  readme: boolean;           // show the repo's README on the page
  writeup?: { label: string; href: string };   // a main button before "View on GitHub"
}

export const projects: Project[] = [
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
    writeup: {"label": "Read the write-up", "href": "/research/chicago-home-value"},
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
  },
  {
    slug: "alexanderk-dev",
    name: "alexanderk.dev",
    tagline: "This website",
    summary: "This website. Built with Astro into plain HTML, CSS and JavaScript, and hosted on Cloudflare.",
    repo: "amkashyap1220/alexanderk.dev",
    chips: ["Astro", "HTML", "CSS", "JavaScript", "GitHub API", "Cloudflare"],
    when: {"start": "2026", "end": "present"},
    readme: true,
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
  },
];

export function project(slug: string): Project {
  const p = projects.find((x) => x.slug === slug);
  if (!p) throw new Error("No project " + slug + " in src/data/projects.ts");
  return p;
}
