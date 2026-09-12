/**
 * English - the source of truth for the scanner's messages.
 *
 * WRITTEN FOR SOMEBODY STANDING AT A DOOR, not sitting at a desk. The verdict
 * words are the ones a guard reads at arm's length while looking at a visitor's
 * face, so they stay short in all three languages even where a longer phrase
 * would be more literal.
 *
 * `pt.ts` and `tet.ts` are typed as `Messages`, so omitting a key is a compile
 * error rather than an English word appearing on a phone at a door.
 *
 * Non-ASCII is written as \uXXXX escapes and these files are generated - see
 * the dashboard's `lib/locales/en.ts` for the incident that made that a rule.
 */
export const en = {

  // ------------------------------------------------------------ verdicts --
  "verdict.valid.headline": "Welcome",
  "verdict.valid.detail": "Badge is valid",
  "verdict.invalid.headline": "Not a valid badge",
  "verdict.invalid.detail": "This QR code is not from this event",
  "verdict.revoked.headline": "Badge revoked",
  "verdict.revoked.detail": "Do not admit. Send them to the registration desk",
  "verdict.duplicate.headline": "Already scanned",
  "verdict.duplicate.detail": "Same badge within the last minute",
  "verdict.tapContinue": "Tap to continue",
  "verdict.tapNext": "Tap to scan the next badge",
  "verdict.badgePhoto": "Badge photo of {name}",
  "verdict.queued": "Queued, not verified. {name}. Tap to continue.",
  "verdict.unknownBadge": "Unknown badge",

  // -------------------------------------------------------------- camera --
  "camera.hint": "Hold the badge QR inside the frame",
  "camera.checking": "Checking\u2026",
  "camera.off": "The camera is off",
  "camera.why":
    "This app reads badge QR codes and does nothing else with the camera. No photos are taken and nothing is stored on the phone.",
  "camera.allow": "Allow the camera",
  "camera.openSettings": "Open settings to allow it",
  "camera.torchOn": "Torch on",
  "camera.torch": "Torch",
  "camera.turnTorchOn": "Turn the torch on",
  "camera.turnTorchOff": "Turn the torch off",
  "camera.fallbackName": "Scanner",
  "camera.unpairA11y": "Unpair this phone",

  // --------------------------------------------------------------- queue --
  "queue.syncingOne": "Syncing. {count} scan still pending.",
  "queue.syncingMany": "Syncing. {count} scans still pending.",

  // ------------------------------------------------------------- pairing --
  "pair.title": "Pair this phone",
  "pair.body": "Enter the scanner pairing code from the dashboard.",
  "pair.codeLabel": "Six character pairing code",
  "pair.nameLabel": "Name this phone",
  "pair.namePlaceholder": "North door",
  "pair.nameA11y": "Device name",
  "pair.failed": "Pairing failed. Try again.",
  "pair.noStorage":
    "This browser will not store anything, so a token cannot be kept. Leave private browsing, or run the scanner on a phone.",
  "pair.browserStorage":
    "This browser has no secure keystore, so the token is kept in ordinary browser storage. Fine for a check-in desk you control \u2014 revoke this device from the dashboard when the event is over.",
  "pair.finding": "Finding the server\u2026",
  "pair.noServer": "No server found",

  // -------------------------------------------------------------- unpair --
  "unpair.title": "Unpair this phone?",
  "unpair.body":
    "It stops being able to record scans until it is paired again with a new code. Revoke it from the dashboard as well if the phone is lost.",
  "unpair.keep": "Keep paired",
  "unpair.confirm": "Unpair",

  // -------------------------------------------------------------- server --
  "server.whereIsIt": "Where is the server?",
  "server.cannotReach": "CANNOT REACH THE SERVER",
  "server.alreadyTried": "Already tried",
  "server.address": "Server address",
  "server.addressA11y": "Server IP address and port",
  "server.ipLabel": "IP address or hostname",
  "server.portLabel": "Port",
  "server.ipA11y": "Server IP address or hostname",
  "server.portA11y": "Server port",
  "server.hint":
    "Ask the machine running the server for its IP address, or run {cmd} on it.",
  "server.test": "Test connection",
  "server.save": "Save address",
  "server.useBuiltIn": "Use the built-in address again",
  "server.cancel": "Cancel",
  "server.connect": "Connect",
  "server.searching": "Searching\u2026",
  "server.retrySaved": "Try the saved addresses again",
  "server.settingsA11y": "Server address settings",
  "server.checking": "Checking",
  "server.online": "Online",
  "server.offline": "Offline",

  // ------------------------------------------------------- server errors --
  "server.badAddress":
    "That does not look like an address. Try something like 192.168.0.63.",
  "server.timeout":
    "No answer within five seconds. Check that this phone and the server are on the same Wi-Fi.",
  "server.refused":
    "Nothing is listening there. Check the address, and that the server is running.",
  "server.notVms":
    "Something answered, but it is not the VMS server (HTTP {status}). Check the port.",
  "server.nothingAnswered":
    "Nothing answered there. Check the address, and that the server is on and on this network.",
  "settings.hint":
    "Point this phone at the server. Ask whoever set up the laptop for its IP address, or run {cmd} on it.",
  "settings.testFirst": "Test the address before saving it.",
  "settings.connected": "Connected. This is the VMS server.",
  "settings.reports": "It reports {ip}.",
  "setup.hint":
    "Ask whoever set up the laptop for its IP address, or run {cmd} on it. The port is almost always 8000.",
  "setup.bareIp":
    "A bare IP is fine \u2014 http:// and the port are filled in for you.",

  // ------------------------------------------------------------ language --
  "language.label": "Language",
} as const;

/** Every message key in the scanner. */
export type MessageKey = keyof typeof en;

/** The shape a translation has to satisfy. */
export type Messages = Record<MessageKey, string>;
