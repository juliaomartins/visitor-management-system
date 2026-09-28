/**
 * Copy text to the clipboard on a plain-http LAN.
 *
 * `navigator.clipboard` IS SECURE-CONTEXT ONLY. This dashboard is reached by IP
 * over http (CLAUDE.md hard constraint 9), so on every machine at the event
 * except the server's own `localhost` the API is simply absent -- and three
 * copy buttons (the desk link, the server address, the badge token) quietly did
 * nothing but leave the text selected, with no label change to say why.
 *
 * So the deprecated `document.execCommand("copy")` is the path that actually
 * runs at the event. It is not gated on a secure context, it works in every
 * browser these devices have, and the selection it needs is put back the way it
 * was afterwards, so nothing is left highlighted.
 *
 * THE ORDER IS GESTURE-CRITICAL. `execCommand` only works inside a user
 * gesture, and awaiting a promise ends one -- so when there is no secure
 * context the synchronous path is tried FIRST, before any `await`. Reversing
 * those two lines breaks copying on exactly the machines that need it.
 */

export type CopyOutcome =
  /** On the clipboard. */
  | "copied"
  /** Not copied, but selected so it can be taken by hand. */
  | "selected"
  /** Nothing worked. */
  | "failed";

/** Select an element's text, so a person can copy it themselves. */
function selectNode(node: HTMLElement | null | undefined): boolean {
  if (!node) return false;
  const selection = window.getSelection();
  if (!selection) return false;

  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/**
 * The http path: a throwaway textarea, selected and copied, with the visitor's
 * own selection restored so the page does not look touched.
 */
function copyWithCommand(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  // Off-screen but focusable: `display: none` cannot be selected, and a visible
  // one scrolls the page as it takes focus.
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.width = "1px";
  area.style.height = "1px";
  area.style.padding = "0";
  area.style.border = "none";
  area.style.opacity = "0";

  const selection = window.getSelection();
  const previous =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(area);
  area.focus();
  area.select();
  // iOS ignores `select()` on a readonly field; this is what it honours.
  area.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  area.remove();

  if (selection) {
    selection.removeAllRanges();
    if (previous) selection.addRange(previous);
  }

  return copied;
}

/**
 * Put `text` on the clipboard, falling back to selecting `fallback` if it
 * cannot be. The caller decides what to say about each outcome.
 */
export async function copyText(
  text: string,
  fallback?: HTMLElement | null,
): Promise<CopyOutcome> {
  if (!text) return "failed";

  const modern =
    typeof window !== "undefined" && window.isSecureContext
      ? navigator.clipboard
      : undefined;

  // No secure context: stay synchronous, inside the click.
  if (!modern) {
    if (copyWithCommand(text)) return "copied";
    return selectNode(fallback) ? "selected" : "failed";
  }

  try {
    await modern.writeText(text);
    return "copied";
  } catch {
    // Permission refused, or a browser that has the API and will not use it.
    if (copyWithCommand(text)) return "copied";
    return selectNode(fallback) ? "selected" : "failed";
  }
}
