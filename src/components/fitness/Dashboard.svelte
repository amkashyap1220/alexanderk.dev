<!--
  Fitness dashboard (/private/fitness-tracking).

  The data comes from /private/api/fitness/data (worker/fitness.js reads the
  fitness-data repo), and the plan engine itself from
  /private/api/fitness/engine.js: the same code the daily Claude session
  runs, so "Up next" here always matches what the session will suggest,
  including ranking changes you haven't saved into a session yet.

  This file loads both and lays out the page; each panel is its own
  component next to it. No workout data is in this repo.
-->
<script>
  import { onMount } from "svelte";
  import { API } from "./fit.js";
  import UpNext from "./UpNext.svelte";
  import Stats from "./Stats.svelte";
  import BodyWeight from "./BodyWeight.svelte";
  import WeakAreas from "./WeakAreas.svelte";
  import Strength from "./Strength.svelte";
  import Calendar from "./Calendar.svelte";
  import Volume from "./Volume.svelte";
  import Cardio from "./Cardio.svelte";
  import History from "./History.svelte";
  import LiftRankings from "./LiftRankings.svelte";
  import LiftRequests from "./LiftRequests.svelte";
  import Tooltip from "./Tooltip.svelte";

  // D: the data, E: the engine, A: the analysis, today: today's date where you live.
  // D is replaced (never edited in place) when you save, so the panels redraw.
  let D = $state.raw(null), E = $state.raw(null), A = $state.raw(null), today = $state(null);
  let error = $state("");

  async function load() {
    try {
      const [res, engine] = await Promise.all([fetch(API + "data", { cache: "no-store" }), import(/* @vite-ignore */ API + "engine.js")]);
      if (res.status === 401) { location.href = "/login?next=" + encodeURIComponent(location.pathname); return; }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || res.status);
      E = engine;
      today = E.localDate(body.preferences.timezone || "America/Chicago");
      A = E.analyze({ ...body, date: today, weeks: 16 });
      D = body;
    } catch (err) {
      error = "Couldn't load your workouts: " + err.message;
    }
  }

  onMount(() => { load(); });

  const setPreferences = (preferences) => { D = { ...D, preferences }; };
</script>

<p class="fit-status" id="fit-status" class:error role="status" hidden={!!D}>{error || "Loading your workouts…"}</p>

{#if D}
  <div id="fit-app">
    <h2 class="section-title">Up next</h2>
    <UpNext {D} {E} {today} />

    <Stats {D} {E} {A} {today} />

    <h2 class="section-title fit-h">Body weight</h2>
    <p class="section-intro">From the weigh-ins you give your daily session. They swing a few pounds with water and food, so the line is the 7-day average.</p>
    <BodyWeight {D} {E} {today} />

    <h2 class="section-title fit-h">Weak areas</h2>
    <p class="section-intro">Muscles under the weekly set target, lifts that stopped improving, and push vs pull balance, over the last 4 weeks. The fifth lift of each session goes to the biggest gap.</p>
    <WeakAreas {D} {E} {A} />

    <h2 class="section-title fit-h">Strength</h2>
    <p class="section-intro">Estimated 1-rep max per session (best set, Epley formula). Bigger dots are new bests.</p>
    <Strength {D} {A} />

    <h2 class="section-title fit-h">Consistency</h2>
    <Calendar {D} {E} {A} {today} />

    <h2 class="section-title fit-h">Weekly sets per muscle</h2>
    <p class="section-intro">Average over the last 4 weeks. Main muscles count a full set, helpers half. The shaded band is the 10 to 20 set target.</p>
    <Volume {D} {A} />

    <h2 class="section-title fit-h">Cardio</h2>
    <p class="section-intro">Minutes per week by machine. The tick on each week is 25 minutes for every workout you finished.</p>
    <Cardio {D} {A} />

    <h2 class="section-title fit-h">Previous workouts</h2>
    <History {D} {E} {A} />

    <h2 class="section-title fit-h" id="my-lifts">My lifts</h2>
    <p class="section-intro">Rank the lifts you like in each slot; your #1 is suggested first, and what you actually log counts too. "Never" keeps a lift out of your plans. Saving updates the fitness-data repo, and the next plan uses it.</p>
    <LiftRankings {D} onsave={setPreferences} />

    <h3 class="fit-h3">Add a lift</h3>
    <p class="fit-why">Type a lift you want in your plans, in your own words. Your next daily session works out where it fits, adds it, and tells you.</p>
    <LiftRequests {D} onchange={(requests) => setPreferences({ ...D.preferences, requests })} />
  </div>
{/if}

<Tooltip />
