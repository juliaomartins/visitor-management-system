"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Text that shrinks to fit its box instead of pushing the layout apart.
 *
 * `clamp()` cannot do this. A CSS clamp knows the viewport and nothing else — it
 * has no idea whether the string is "Ada Lovelace" or
 * "(UPDATE IT) JULIAO MARTINS", so it sizes both the same and the long one runs
 * off the screen, taking the header and the name plate with it. The only way to
 * size text to its content is to measure the rendered result, which means the
 * DOM, which means a hook.
 *
 * THE LADDER, in order. Identity beats decoration, so the name never pays first:
 *
 *   1. one line at the ideal size
 *   2. up to `maxLines` at the ideal size
 *   3. step down toward `min`, still within `maxLines`
 *   4. at `min` it stops. Below the floor a name is not "smaller", it is
 *      unreadable at five metres, which defeats the point of the screen — so the
 *      photo gives up its height instead (it is `shrink` in the hero column).
 *
 * Never ellipsized, never overflowed. A truncated name cannot tell the person
 * standing there whether the screen means them.
 */
type Props = {
  children: string;
  /** Ideal size in px. The search starts here and only ever goes down. */
  max: number;
  /** Legibility floor in px. The search never goes below this. */
  min: number;
  /** Lines allowed before the size starts stepping down. */
  maxLines?: number;
  /** Multiplier, so the line-box maths is exact rather than inherited. */
  lineHeight?: number;
  className?: string;
  /** Rendered element. A name is a heading; a caption is not. */
  as?: "p" | "h1" | "h2" | "span";
};

export function FitText({
  children,
  max,
  min,
  maxLines = 2,
  lineHeight = 1.06,
  className = "",
  as: Tag = "p",
}: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const text = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState(max);

  useEffect(() => {
    const boxEl = box.current;
    const textEl = text.current;
    if (!boxEl || !textEl) return;

    // Only the WIDTH of the box drives a refit. The box's height changes as a
    // side effect of resizing the text inside it, so reacting to height would
    // be a ResizeObserver feedback loop — measure, grow, measure, forever.
    let lastWidth = -1;

    const fit = () => {
      const width = boxEl.clientWidth;
      if (width === 0 || width === lastWidth) return;
      lastWidth = width;

      // Binary search rather than a step-down loop: six layout flushes to land
      // on the pixel instead of fifty, which matters because this runs on every
      // arrival and every resize.
      let low = min;
      let high = max;
      let best = min;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        textEl.style.fontSize = `${mid}px`;

        const lines = Math.round(textEl.scrollHeight / (mid * lineHeight));
        // scrollWidth catches a single token too long to break — the height
        // check alone would call that a pass.
        const fits = lines <= maxLines && textEl.scrollWidth <= width + 1;

        if (fits) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      textEl.style.fontSize = "";
      setSize(best);
    };

    // Measurement and the state write both happen in the observer callback, not
    // in the effect body: the first delivery is what gives the initial fit.
    const observer = new ResizeObserver(fit);
    observer.observe(boxEl);

    // Fonts change metrics after they load, and a webfont landing late would
    // otherwise leave the text sized against the fallback.
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (cancelled) return;
      lastWidth = -1;
      fit();
    });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [children, max, min, maxLines, lineHeight]);

  return (
    <div ref={box} className="w-full min-w-0">
      <Tag
        ref={text as React.Ref<never>}
        className={`break-words ${className}`}
        style={{ fontSize: `${size}px`, lineHeight }}
      >
        {children}
      </Tag>
    </div>
  );
}
