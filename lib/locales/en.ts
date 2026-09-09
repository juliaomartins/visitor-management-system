/**
 * English - the source of truth for every message in the dashboard.
 *
 * THIS FILE DEFINES THE KEY SET. `pt.ts` and `tet.ts` are typed as `Messages`,
 * so leaving a key out of either one is a TypeScript error rather than a screen
 * that silently falls back to English in front of a delegate. Adding a message
 * means adding it here first; the compiler then names what is missing.
 *
 * Keys are namespaced by where they appear, not by what they say. Two screens
 * that share a word in English still get their own key, because they can
 * diverge in Tetun, where the noun governs the verb.
 *
 * NON-ASCII IS WRITTEN AS \uXXXX ESCAPES ON PURPOSE, and these files are
 * generated rather than hand-edited. The first version of them was written
 * through a shell heredoc on Windows and came back with "\u00e7\u00f5" turned
 * to mojibake -- invisible in a diff until it reaches a delegate. An ASCII file
 * cannot be transcoded by anything in the chain.
 *
 * `{name}` placeholders are filled by `t(key, { name })` - see `lib/i18n.tsx`.
 */
export const en = {

  // --------------------------------------------------------------- shell --
  "nav.sections": "Sections",
  "nav.group.overview": "Overview",
  "nav.group.accreditation": "Accreditation",
  "nav.group.operations": "Operations",
  "nav.dashboard": "Dashboard",
  "nav.dashboard.hint": "Arrivals and door health",
  "nav.visitors": "Visitors",
  "nav.visitors.hint": "Register and issue badges",
  "nav.badges": "Badges",
  "nav.badges.hint": "Print queue",
  "nav.devices": "Devices",
  "nav.devices.hint": "Doors and screens",
  "nav.reports": "Reports",
  "nav.reports.hint": "Entrance log",
  "nav.expand": "Expand menu",
  "nav.collapse": "Collapse menu",
  "nav.signOut": "Sign out",
  "nav.signingOut": "Signing out\u2026",
  "nav.silentDevices": "{count} device not checked in recently",
  "shell.restoringSession": "Restoring session",
  "topbar.localTime": "Local time",

  // --------------------------------------------------------- preferences --
  "theme.toDark": "Switch to dark mode",
  "theme.toLight": "Switch to light mode",
  "theme.dark": "Dark",
  "theme.light": "Light",
  "language.label": "Language",
  "language.choose": "Choose a language",

  // --------------------------------------------------------------- login --
  "login.title": "Sign in",
  "login.intro":
    "Administrator accounts only. Guards use a paired phone, and the lobby screen pairs itself.",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.submitting": "Signing in\u2026",
  "login.badCredentials": "That username and password did not match.",
  "login.failedStatus": "Sign-in failed (HTTP {status}).",
  "login.unreachable":
    "Could not reach the server. Check that the backend is running.",
  "login.servingFrom": "Serving from",
  "login.pitch":
    "Register a visitor, print their card, and watch every arrival land in one place \u2014 on your own network, with nothing leaving the building.",

  // -------------------------------------------------------------- errors --
  "error.unexpected": "Something went wrong.",
  "error.fields": "Some fields need attention.",
  "error.visitorLoad": "That visitor could not be loaded.",
  "error.visitorRegister": "The visitor could not be registered.",
  "error.visitorSave": "The changes could not be saved.",
  "error.visitorActivate": "The visitor could not be activated.",
  "error.visitorDeactivate": "The visitor could not be deactivated.",
  "error.visitorDelete": "The visitor could not be deleted.",

  // -------------------------------------------------------- visitor list --
  "visitors.title": "Visitors",
  "visitors.subtitle": "Everyone registered for the event",
  "visitors.search": "Search visitors",
  "visitors.searchPlaceholder": "Name, organisation, country or badge serial",
  "visitors.filterCategory": "Filter by category",
  "visitors.tab.all": "Everyone",
  "visitors.tab.normal": "Normal",
  "visitors.tab.vip": "VIP",
  "visitors.exportTitle":
    "Spreadsheet of everyone registered. Nothing is reissued.",
  "visitors.exporting": "Exporting\u2026",
  "visitors.export": "Export .xlsx",
  "visitors.exportFailed": "The roster could not be exported.",
  "visitors.register": "Register visitor",
  "visitors.refreshing": "Refreshing\u2026",
  "visitors.loadFailed": "Could not load visitors",
  "visitors.requestFailed": "The request failed before it reached the server.",
  "visitors.serverRejected": "The server rejected that request.",
  "visitors.noneMatch": "No one matches those filters",
  "visitors.noneMatchBody": "Try a shorter search, or widen the category.",
  "visitors.empty": "No visitors yet",
  "visitors.emptyBody": "Register the first visitor to issue a badge.",
  "visitors.menu.edit": "Edit details",
  "visitors.menu.deactivate": "Deactivate visitor",
  "visitors.menu.activate": "Activate visitor",
  "visitors.menu.delete": "Delete permanently",
  "visitors.status.deactivated": "Deactivated",

  // --------------------------------------------------- deactivate dialog --
  "deactivate.title": "Deactivate {name}?",
  "deactivate.body":
    "Badge {serial} stops working immediately. The next scan of it shows red at the door.",
  "deactivate.point1": "They stay on the visitor list, marked deactivated.",
  "deactivate.point2": "Their scan history is kept.",
  "deactivate.point3":
    "Reversible. Activating puts the same printed card back to work \u2014 there is nothing to reprint.",
  "deactivate.cancel": "Keep them active",
  "deactivate.confirm": "Deactivate",
  "deactivate.pending": "Deactivating\u2026",

  // -------------------------------------------------------- purge dialog --
  "purge.warning": "Cannot be undone",
  "purge.title": "Delete {name} permanently?",
  "purge.body":
    "This removes the registration and the visitor\u2019s photo from the server. Deactivating is the reversible option; this is not it.",
  "purge.scansUnknown":
    "Any scans of this badge stay in the entrance log but stop naming anybody.",
  "purge.scansNone":
    "No scans are affected \u2014 this badge has never been presented.",
  "purge.scansOne":
    "{count} scan stays in the entrance log but stops naming anybody.",
  "purge.scansMany":
    "{count} scans stay in the entrance log but stop naming anybody.",
  "purge.serialRetired": "Badge {serial} is retired. The serial is not reused.",
  "purge.reRegister":
    "Registering them again later creates a new visitor, a new serial and a new QR.",
  "purge.typeToConfirm": "Type {serial} to confirm",
  "purge.cancel": "Cancel",
  "purge.confirm": "Delete permanently",
  "purge.pending": "Deleting\u2026",

  // ------------------------------------------------------ visitor detail --
  "common.loading": "Loading\u2026",
  "visitor.fallbackTitle": "Visitor",
  "visitor.notFound": "Could not load this visitor",
  "visitor.notFoundBody": "They may have been deleted. Check the visitor list.",
  "visitor.backToAll": "Back to all visitors",
  "visitor.allVisitors": "All visitors",
  "visitor.status.active": "Active",
  "visitor.headingActive": "This badge opens the door",
  "visitor.headingOff": "This badge is switched off",
  "visitor.subActive":
    "Any paired scanner will accept it and the lobby screen will welcome them.",
  "visitor.subOff":
    "The next scan of it shows red. Activating puts the same card back to work \u2014 nothing needs reprinting.",
  "visitor.registered": "Registered",
  "visitor.arrivals": "Arrivals",
  "visitor.lastArrival": "Last arrival",
  "visitor.notYet": "Not yet",
  "visitor.scansLogged": "Scans logged",
  "visitor.activating": "Activating\u2026",
  "visitor.qrNote":
    "This QR was generated when the visitor was registered and never changes. Reprint the card as often as you need \u2014 it scans the same every time. Deactivating stops it and activating starts it again, both without touching the code on the card. Deleting permanently is the only thing here that cannot be undone.",
  "visitor.scanHistory": "Scan history",
  "visitor.scanHistoryBody":
    "Every time this badge was presented, including the times it was refused.",
  "visitor.noScans": "This badge has not been scanned yet.",
  "visitor.col.event": "Event",
  "visitor.col.scannedAt": "Scanned at",
  "visitor.col.result": "Result",
  "visitor.col.device": "Device",
  "scan.valid": "Valid",
  "scan.duplicate": "Duplicate",
  "scan.revoked": "Revoked",
  "scan.invalid": "Invalid",

  // --------------------------------------------------- registration form --
  "register.title": "Register a visitor",
  "register.subtitle":
    "One badge, printed in advance, valid for the whole event",
  "register.issuedTitle": "Badge issued",
  "register.issuedSubtitle":
    "Print the card now, or from the visitor\u2019s page later",
  "form.photoRequired": "A badge needs a photo. Add one before registering.",
  "form.fullName": "Full name",
  "form.fullNameHint": "As it should read on the badge.",
  "form.country": "Country",
  "form.organisation": "Organisation",
  "form.optional": "Optional.",
  "form.category": "Category",
  "form.cat.normal": "Normal",
  "form.cat.normalNote": "Standard badge",
  "form.cat.vip": "VIP",
  "form.cat.vipNote": "Distinct card and lobby welcome",
  "form.registering": "Registering\u2026",
  "form.saving": "Saving\u2026",
  "form.register": "Register and issue badge",
  "form.save": "Save changes",
  "form.noteCreate":
    "The serial is assigned when you register. The QR is generated at the same moment and never changes afterwards.",
  "form.noteEdit":
    "Editing details does not reissue the badge. The serial and the QR code stay exactly as printed.",

  // ------------------------------------------------------- badge receipt --
  "receipt.badgeIssued": "Badge issued",
  "receipt.registered": "{name} is registered",
  "receipt.permanent":
    "This QR is permanent. It was generated when {name} was registered and will not change \u2014 print it now, or from their page later, as many times as you need. It only stops working if you deactivate or delete the visitor.",
  "receipt.qrAlt": "QR code for badge {serial}",
  "receipt.badgeToken": "Badge token",
  "receipt.rendering": "Rendering\u2026",
  "receipt.downloadPdf": "Download badge PDF",
  "receipt.printBrowser": "Print from browser",
  "receipt.copied": "Copied",
  "receipt.copyToken": "Copy token",
  "receipt.qrFailed":
    "The QR code could not be drawn. Copy the token and print the badge from another machine rather than issuing a card without a code.",
  "receipt.copiedAnnounce": "Badge token copied to the clipboard.",
  "receipt.badgeSerial": "Badge serial",
  "receipt.registerAnother": "Register another visitor",
  "receipt.open": "Open {name}",
  "receipt.renderFailed": "The badge could not be rendered.",

  // ---------------------------------------------------------------- edit --
  "edit.title": "Edit {name}",
  "edit.fallbackTitle": "Edit visitor",
} as const;

/** Every message key in the dashboard. */
export type MessageKey = keyof typeof en;

/**
 * The shape a translation has to satisfy.
 *
 * `Record<MessageKey, string>` rather than `typeof en`: the English values are
 * literal types, and a translation must be free to say something different
 * while still covering every key.
 */
export type Messages = Record<MessageKey, string>;
