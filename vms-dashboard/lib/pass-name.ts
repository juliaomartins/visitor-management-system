/**
 * Naming and line-breaking for the saved pass image.
 *
 * PURE, AND IMPORTS NOTHING, so `node --test` runs it without a bundler and
 * without a canvas: the width of a string is passed in as a function.
 */

const FILE_BASE = "drcc-2026-badge";

/** A file name a phone will accept, built from the badge serial. */
export function passFileName(serial: string): string {
  const slug = serial
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${FILE_BASE}-${slug}.png` : `${FILE_BASE}.png`;
}

/**
 * Break text into lines that fit `maxWidth`, measured by the caller.
 *
 * A word longer than the line is broken mid-word rather than left to overflow:
 * the pass carries names nobody vetted, and one long word running off the edge
 * of a saved image cannot be fixed by the person holding it.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (measure(word) > maxWidth) {
      if (current) {
        lines.push(current);
        current = "";
      }
      let chunk = "";
      for (const character of word) {
        if (chunk && measure(chunk + character) > maxWidth) {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk += character;
        }
      }
      current = chunk;
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}
