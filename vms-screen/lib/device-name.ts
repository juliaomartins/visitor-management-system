/**
 * A name for this display, suggested from what the browser will say about itself.
 *
 * WHAT A BROWSER CANNOT TELL YOU is the one thing an administrator wants: the
 * machine's own name ("LOBBY-PC-01") or where it stands. No web API exposes the
 * hostname, by design. What it does expose is the browser and the operating
 * system, which is enough to tell two kiosks apart in the device list when
 * nobody has typed anything better — and the field stays editable because
 * "Main entrance" beats "Chrome on Windows" in every log anybody reads.
 *
 * TWO SOURCES, AND THE RICHER ONE IS USUALLY MISSING HERE.
 *
 * `navigator.userAgentData` (User-Agent Client Hints) can say Windows 11 rather
 * than Windows, and an Android tablet's model. It is a SECURE-CONTEXT API, and
 * this screen runs over plain `http://<lan-ip>` on purpose (CLAUDE.md hard
 * constraint 9) — so on the real kiosk it is absent and only `localhost` gets
 * it. The same rule already costs the scanner its camera on web.
 *
 * `navigator.userAgent` works everywhere, and it is deliberately vague: Chrome's
 * reduced UA string reports every Windows as "Windows NT 10.0" and every Android
 * model as "K". So the fallback names the browser and the OS family, and the
 * refinement adds precision only when the browser is willing to give it.
 *
 * The result is DATA, not interface text: it is stored by the backend and read
 * in the dashboard and the server log, so it is English whatever language the
 * pairing screen is in — the same rule `SCREEN_NAME` follows.
 */

/** What the field falls back to, and what the backend would never guess. */
export const SCREEN_NAME = "Lobby screen";

/** The backend's `Device.name` is a CharField(max_length=100). */
export const NAME_MAX = 100;

type Brand = { brand: string; version: string };

type HighEntropy = {
  platform?: string;
  platformVersion?: string;
  model?: string;
};

/** Not in TypeScript's DOM lib yet, and absent outside a secure context. */
type UserAgentData = {
  brands?: Brand[];
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<HighEntropy>;
};

function browserFrom(ua: string): string | null {
  // Order matters: Edge and Opera both also say "Chrome", and Chrome says "Safari".
  if (/\bEdg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/\bOPR\//.test(ua)) return "Opera";
  if (/\bFirefox\//.test(ua)) return "Firefox";
  // No `\b` here: it cannot match inside "HeadlessChrome/", which then fell
  // through to "Safari". Edge and Opera are already caught above.
  if (/(Chrome|CriOS)\//.test(ua)) return "Chrome";
  if (/\bSafari\//.test(ua)) return "Safari";
  return null;
}

function systemFrom(ua: string): string | null {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

function compose(browser: string | null, system: string | null): string {
  const detail =
    browser && system ? `${browser} on ${system}` : (browser ?? system);
  return (detail ? `${SCREEN_NAME} (${detail})` : SCREEN_NAME).slice(0, NAME_MAX);
}

/**
 * The immediate suggestion, from the UA string alone. Synchronous, so the field
 * is filled the moment the page mounts, and available on plain http.
 */
export function suggestScreenName(): string {
  if (typeof navigator === "undefined") return SCREEN_NAME;
  const ua = navigator.userAgent ?? "";
  return compose(browserFrom(ua), systemFrom(ua));
}

/**
 * A more precise suggestion, when Client Hints are available — or `null`, which
 * on the kiosk over LAN http is the ordinary answer rather than a failure.
 *
 * Windows 11 is not a separate platform in Client Hints: it reports
 * `platformVersion` 13.0.0 or higher, where Windows 10 reports 1 to 10.
 */
export async function refineScreenName(): Promise<string | null> {
  if (typeof navigator === "undefined") return null;
  const data = (navigator as Navigator & { userAgentData?: UserAgentData })
    .userAgentData;
  if (!data?.getHighEntropyValues) return null;

  try {
    const hints = await data.getHighEntropyValues(["platformVersion", "model"]);
    const ua = navigator.userAgent ?? "";
    const browser = browserFrom(ua);
    let system = hints.platform || data.platform || systemFrom(ua);

    if (system === "Windows" && hints.platformVersion) {
      const major = Number.parseInt(hints.platformVersion, 10);
      if (major >= 13) system = "Windows 11";
      else if (major > 0) system = "Windows 10";
    }

    // An Android tablet can name itself; that is closer to a device than a browser.
    const model = hints.model?.trim();
    if (model) return `${SCREEN_NAME} (${model})`.slice(0, NAME_MAX);

    return compose(browser, system);
  } catch {
    return null;
  }
}
