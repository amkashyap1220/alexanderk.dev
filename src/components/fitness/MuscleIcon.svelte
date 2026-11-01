<!--
  8×8 pixel figure, one per muscle group (the muscles in fitness-data's
  program.json): the same little lifter each time, with that muscle lit up
  in its day's color (push blue, pull orange, legs green). Renders nothing
  for an unknown muscle.

    H hair   S skin   P shorts   # the muscle
-->
<script module>
  import { DAY_COLOR } from "./fit.js";

  const COLORS = { H: "#1b1b1b", S: "#b98257", P: "#4a5a70" };

  // Seen from the front, from behind, and with the arms out to the sides
  const FRONT = ["...HH...", "...SS...", ".SSSSSS.", "S.SSSS.S", "S.SSSS.S", "..PPPP..", "..S..S..", "..S..S.."];
  const BACK = ["...HH...", "...HH...", ".SSSSSS.", "S.SSSS.S", "S.SSSS.S", "..PPPP..", "..S..S..", "..S..S.."];
  const ARMS_OUT = ["...HH...", "...SS...", "SSSSSSSS", "..SSSS..", "..SSSS..", "..PPPP..", "..S..S..", "..S..S.."];

  // Each muscle: the pose, its day, and the [x, y] pixels it covers
  const MUSCLES = {
    chest:       [FRONT, "push", [[2, 3], [3, 3], [4, 3], [5, 3]]],
    front_delts: [FRONT, "push", [[1, 2], [6, 2]]],
    side_delts:  [ARMS_OUT, "push", [[1, 2], [6, 2]]],
    triceps:     [BACK, "push", [[0, 3], [7, 3]]],
    rear_delts:  [BACK, "pull", [[1, 2], [6, 2]]],
    lats:        [BACK, "pull", [[2, 3], [5, 3], [2, 4], [5, 4]]],
    upper_back:  [BACK, "pull", [[3, 3], [4, 3]]],
    traps:       [BACK, "pull", [[2, 2], [3, 2], [4, 2], [5, 2]]],
    biceps:      [FRONT, "pull", [[0, 3], [7, 3]]],
    forearms:    [FRONT, "pull", [[0, 4], [7, 4]]],
    quads:       [FRONT, "legs", [[2, 6], [5, 6]]],
    hamstrings:  [BACK, "legs", [[2, 6], [5, 6]]],
    glutes:      [BACK, "legs", [[2, 5], [3, 5], [4, 5], [5, 5]]],
    calves:      [BACK, "legs", [[2, 7], [5, 7]]],
    core:        [FRONT, "legs", [[2, 4], [3, 4], [4, 4], [5, 4]]],
    lower_back:  [BACK, "legs", [[3, 4], [4, 4]]],
  };

  // The figure's pixels as {x, y, fill}, or null for an unknown muscle
  function pixels(muscle) {
    const art = MUSCLES[muscle];
    if (!art) return null;
    const [pose, day, lit] = art;
    const on = new Set(lit.map(([x, y]) => `${x},${y}`));
    const out = [];
    pose.forEach((row, y) => [...row].forEach((c, x) => {
      if (c !== ".") out.push({ x, y, fill: on.has(`${x},${y}`) ? DAY_COLOR[day] : COLORS[c] });
    }));
    return out;
  }
</script>

<script>
  let { muscle } = $props();
  const px = $derived(pixels(muscle));
</script>

{#if px}
  <svg class="fit-px" viewBox="0 0 8 8" aria-hidden="true" shape-rendering="crispEdges">
    {#each px as p}<rect x={p.x} y={p.y} width="1" height="1" fill={p.fill} />{/each}
  </svg>
{/if}
