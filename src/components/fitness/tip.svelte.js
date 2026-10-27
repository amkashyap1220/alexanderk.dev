// The one tooltip every chart shares (drawn by Tooltip.svelte). Any element
// with data-tip="Title\nline\nline" gets it on hover; a chart can also call
// showTip itself, e.g. for the point nearest the pointer.
export const tip = $state({ open: false, x: 0, y: 0, title: "", lines: [] });

export function showTip(x, y, title, lines) {
  Object.assign(tip, { open: true, x, y, title, lines });
}

export const hideTip = () => { tip.open = false; };
