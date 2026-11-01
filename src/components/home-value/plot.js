// Drawing helpers shared by the map and the fit vs price chart (Observable Plot)
import * as Plot from "@observablehq/plot";
import { scaleLinear, interpolateLab } from "d3";
import { css } from "./hv.js";

// A Plot chart in el, labelled for screen readers; clicking (or tapping) a zip opens its details
export function frame(el, width, height, marks, label, onselect, extra = {}) {
  const plot = Plot.plot({
    width, height, margin: 4,
    style: { background: "transparent", color: css("--muted"), fontFamily: css("--font"), fontSize: "11px" },
    marks, ...extra,
  });
  plot.setAttribute("aria-label", label);
  plot.setAttribute("role", "img");
  plot.addEventListener("click", () => {
    const v = plot.value;
    const zip = v && (v.id || v.zip);
    if (zip) onselect(zip);
  });
  el.replaceChildren(plot);
}

// Price vs expected: blue below, neutral in line, purple above
export function valueColor() {
  return scaleLinear().domain([-0.4, 0, 0.4]).range(["--hv-below", "--hv-mid", "--hv-above"].map(css)).interpolate(interpolateLab).clamp(true);
}
