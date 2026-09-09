"use client";

import { ArrivalStage } from "@/components/WelcomeCard";
import type { ScreenEvent } from "@/lib/api";

/**
 * A VIP arrival.
 *
 * Same stage, gold instead of blue. The distinction has to survive a glance from
 * across a lobby by someone who is not looking for it, so the accent carries it
 * in four places at once — the headline, the ring around the face, the status
 * chip and the wave — and the chip spells it out in words as well.
 *
 * One component, one layout, one prop. A separate hand-built VIP card would drift
 * from the normal one the first time either is touched, and the drift would show
 * up on the wall in front of a guest.
 */
export function VipWelcomeCard({
  event,
  queued = [],
}: {
  event: ScreenEvent;
  queued?: ScreenEvent[];
}) {
  return <ArrivalStage event={event} vip queued={queued} />;
}
