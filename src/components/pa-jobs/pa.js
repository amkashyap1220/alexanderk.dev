// Number formats, colors and the theme watcher shared by the PA job market
// charts (the .svelte files next to this one). No page code here.
import * as Plot from "@observablehq/plot";

// A CSS variable's current value, so charts follow the light and dark themes
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Calls fn whenever js/theme.js swaps .light/.dark on <html>; returns the stop function
export function onTheme(fn) {
  const watch = new MutationObserver(fn);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => watch.disconnect();
}

export const money = (x) => (x == null ? "n/a" : "$" + Math.round(x).toLocaleString());
export const k = (x) => (x == null ? "n/a" : "$" + Math.round(x / 1000) + "k");
export const pct = (x, digits = 0) => (x == null ? "n/a" : x.toFixed(digits) + "%");
export const num = (x) => (x == null ? "n/a" : Math.round(x).toLocaleString());

// A Plot chart in el, labelled for screen readers
export function draw(el, label, options) {
  const plot = Plot.plot({
    style: { background: "transparent", color: css("--muted"), fontFamily: css("--font"), fontSize: "11px" },
    ...options,
  });
  plot.setAttribute("aria-label", label);
  plot.setAttribute("role", "img");
  el.replaceChildren(plot);
  return plot;
}

// Labels get a halo in the page color so they stay readable over marks
export const halo = () => ({ stroke: css("--bg"), strokeWidth: 4, paintOrder: "stroke" });

// Charts get their number format by name, since a page can't hand a
// function to a component: the text format, and a shorter one for axis ticks
const FORMATS = {
  pct: [(x) => (x == null ? "n/a" : (Math.round(x * 10) / 10) + "%"), (x) => x + "%"],
  money: [money, k],
  k: [k, k],
};
export const fmt = (name) => FORMATS[name][0];
export const tick = (name) => FORMATS[name][1];

// Layout for a chart with one row per label. On a phone each name goes on
// its own line above its row, so long names never push the chart off screen;
// marks then draw shifted down by dy to sit under their name.
export function rowLayout(data, width, rowHeight = 24) {
  const stacked = width < 560;
  return {
    stacked,
    dy: stacked ? 6 : 0,
    height: data.length * (stacked ? 40 : rowHeight) + 34,
    marginLeft: stacked ? 4 : Math.min(260, Math.max(...data.map((r) => r.label.length)) * 7 + 12),
    y: { domain: data.map((r) => r.label), label: null, tickSize: 0, axis: stacked ? null : "left" },
    names: stacked ? Plot.text(data, { y: "label", text: "label", frameAnchor: "left", textAnchor: "start", dy: -12, fill: css("--muted") }) : null,
  };
}
