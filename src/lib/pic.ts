// The address of a picture in public/, with a short fingerprint of its
// contents on the end: pic("/img/home/x.webp") → "/img/home/x.webp?v=1a2b3c4d".
// Browsers keep /img/* for a day (public/_headers), so a picture replaced under
// the same name could show the old copy until then. The fingerprint changes
// whenever the file does, so a replaced picture shows at once.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const seen = new Map<string, string>();

export function pic(address: string): string {
  let v = seen.get(address);
  if (!v) {
    const bytes = fs.readFileSync(path.join(process.cwd(), "public", address));
    v = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 8);
    seen.set(address, v);
  }
  return `${address}?v=${v}`;
}

// A 1200 px picture and its 640 px copy (<name>-640.webp), as src and srcset
export function pics(name: string) {
  const big = `/img/home/${name}.webp`;
  return { src: pic(big), srcset: `${pic(`/img/home/${name}-640.webp`)} 640w, ${pic(big)} 1200w` };
}
