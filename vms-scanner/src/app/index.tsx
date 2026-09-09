/**
 * The fork in the road, and nothing else.
 *
 * A paired phone goes straight to the camera and never sees anything else again.
 * An unpaired one goes to the setup code. This is the only place that decision is
 * made, so there is one answer rather than a race between screens.
 */
import { Redirect } from "expo-router";

import { useSession } from "@/session";

export default function Index() {
  const { device } = useSession();

  // `loading` is handled in the root layout — this only renders once the keystore
  // has answered, so the redirect is never a guess.
  return <Redirect href={device ? "/scanner" : "/pair"} />;
}
