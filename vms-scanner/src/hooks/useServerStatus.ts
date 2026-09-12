/**
 * Is the server answering — the one question the camera screen cannot fudge.
 *
 * This was inline in `ServerBar` and served one screen. The camera screen needs
 * the same answer, and two copies of a status light is exactly how the two come
 * to disagree, so there is one implementation and the callers differ only in how
 * often they ask.
 *
 * THE PROBE TARGETS THE ADDRESS THE APP IS ACTUALLY USING.
 *
 * It used to read the first stored candidate instead, which is not the same
 * thing: after a change in Settings the stored address was the new one while the
 * client was still sending to the old one, so the light went green at the exact
 * moment scans were going nowhere. A status light that reports on something
 * other than the live connection is worse than none — it is the one thing on
 * screen a guard would trust. Storage is still the fallback, for the moment
 * before the first probe has resolved anything.
 *
 * WHY POLLING IS OPTIONAL, AND WHY THE CAMERA SCREEN OPTS IN.
 *
 * The pairing screen is looked at for a minute; re-checking when it comes into
 * focus is enough, and a timer there would keep the radio awake all day for
 * information nobody is reading. The camera screen is looked at for ten hours,
 * and a guard needs to know the link is down BEFORE a visitor is standing in
 * front of them — not at the badge. So it passes an interval, and the interval
 * stops the moment the app leaves the foreground.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { getApiOrigin, probeServer } from "@/api/client";
import { candidateOrigins } from "@/storage/server";

export type ServerStatus = "checking" | "online" | "offline";

export function useServerStatus(pollMs = 0): {
  status: ServerStatus;
  /** Probe now. Stable, so it is safe in a dependency array. */
  recheck: () => void;
} {
  const [status, setStatus] = useState<ServerStatus>("checking");

  // Mounted and focused. A probe that lands after the screen is gone must not
  // set state, and must not overwrite what the next screen has found.
  const watching = useRef(false);
  const inFlight = useRef(false);

  /*
    "Checking" is shown once, before the first answer, and never again.

    A poll that reset to "checking" on every pass would blink the light grey
    every fifteen seconds for a connection that never dropped — movement in the
    corner of the eye that means nothing, which is the fastest way to teach
    somebody to stop looking at it. Later probes replace the answer silently.
  */
  const settled = useRef(false);

  const probe = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const target = getApiOrigin() || (await candidateOrigins())[0];
      if (!watching.current) return;

      if (!target) {
        settled.current = true;
        setStatus("offline");
        return;
      }

      const health = await probeServer(target);
      if (!watching.current) return;

      settled.current = true;
      setStatus(health ? "online" : "offline");
    } catch {
      // `probeServer` swallows its own failures; this is the belt for anything
      // storage throws on the way to it. A stale light beats a crashed screen.
      if (watching.current && settled.current === false) setStatus("offline");
    } finally {
      inFlight.current = false;
    }
  }, []);

  const recheck = useCallback(() => {
    void probe();
  }, [probe]);

  useFocusEffect(
    useCallback(() => {
      watching.current = true;
      void probe();

      let timer: ReturnType<typeof setInterval> | null = null;

      const start = () => {
        if (pollMs > 0 && timer === null) {
          timer = setInterval(() => void probe(), pollMs);
        }
      };
      const stop = () => {
        if (timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };

      start();

      // A pocketed phone should not be probing, and a phone coming back out
      // should not be showing what was true before it went in.
      const subscription = AppState.addEventListener("change", (next) => {
        if (next === "active") {
          void probe();
          start();
        } else {
          stop();
        }
      });

      return () => {
        watching.current = false;
        stop();
        subscription.remove();
      };
    }, [pollMs, probe]),
  );

  // The focus effect owns the lifecycle; this only catches an unmount that
  // happens without a blur, which `router.replace` can do.
  useEffect(() => {
    return () => {
      watching.current = false;
    };
  }, []);

  return { status, recheck };
}
