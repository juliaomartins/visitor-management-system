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

  // ----------------------------------------------- photo upload and crop --
  "photo.label": "Photo",
  "photo.spec": "3:4 PORTRAIT \u00b7 600 \u00d7 800",
  "photo.notImage": "That is not an image. Choose a JPEG or PNG.",
  "photo.tooLarge": "That image is over 20 MB. Choose a smaller one.",
  "photo.alt": "The visitor\u2019s badge photo",
  "photo.ready": "Cropped and ready.",
  "photo.onFile": "The photo already on file. It stays unless you replace it.",
  "photo.adjustCrop": "Adjust crop",
  "photo.chooseDifferent": "Choose a different photo",
  "photo.add": "Add a photo",
  "photo.dropHint": "Drop one here, or click to choose. You crop it next.",
  "photo.dialogLabel": "Crop the visitor photo",
  "photo.frameFace": "Frame the face",
  "photo.closeWithoutSaving": "Close without saving",
  "crop.alt": "The photo being cropped",
  "crop.preview": "Cropped image",
  "crop.circleHint":
    "Only the circle is printed and shown on the lobby screen. Fill it with the head and shoulders.",
  "crop.aspect": "Aspect ratio",
  "crop.ratio.badge": "Badge (locked)",
  "crop.ratio.square": "Square",
  "crop.ratio.free": "Free",
  "crop.width": "Width",
  "crop.height": "Height",
  "crop.heightLocked": "Height (locked)",
  "crop.tooSmall":
    "This crop is {width}px wide. The badge prints the photo at {min}px for 300dpi, so it will look soft on the card. Crop less, or use a larger photo.",
  "crop.quality": "Image quality",
  "crop.bestCompression": "Best compression",
  "crop.bestQuality": "Best quality",
  "crop.applying": "Applying\u2026",
  "crop.use": "Use this photo",
  "crop.changeImage": "Change image",

  // -------------------------------------------------------------- badges --
  "badges.title": "Badge printing",
  "badges.subtitle": "Nine to an A4 sheet, with cut marks",
  "badges.loadFailed": "The visitor list could not be loaded.",
  "badges.safeTitle": "Printing is safe to repeat",
  "badges.safeBody":
    "Every sheet carries each visitor\u2019s existing QR, so a card can be reprinted as often as you need and the ones already handed out keep working. To stop a lost card, deactivate that visitor on their own page \u2014 the QR itself never changes, so activating them again puts the same card back to work.",
  "badges.searchPlaceholder": "Name, organisation, country or serial",
  "badges.clearSelection": "Clear selection",
  "badges.selectAll": "Select all {count}",
  "badges.print": "Print",
  "badges.printCount": "Print {count}",
  "badges.sheetFailed": "The sheet could not be produced.",
  "badges.export": "Export .xlsx",
  "badges.fileFailed": "The file could not be produced.",
  "badges.selectedOne": "{count} selected \u00b7 {sheets} A4 sheet",
  "badges.selectedMany": "{count} selected \u00b7 {sheets} A4 sheets",
  "badges.noMatch": "No visitors match that search.",
  "badges.onSheet": "On the sheet",
  "badges.notPrinting": "Not printing",

  // ------------------------------------------------------- export dialog --
  "export.titleOne": "Export badge codes for {count} visitor?",
  "export.titleMany": "Export badge codes for {count} visitors?",
  "export.body":
    "This file contains a {strong} for every visitor in it. Nothing is changed by exporting \u2014 the codes are the ones already on their cards \u2014 but anyone holding the file can produce a badge that scans.",
  "export.bodyStrong": "working QR code",
  "export.point1":
    "Send it the way you would send the printed cards, not the way you would send a guest list.",
  "export.point2":
    "Exporting again later produces an identical file. Losing this one costs nothing but the time to export it again.",
  "export.point3":
    "To stop a specific badge, deactivate that visitor on their page. Deleting the file does not stop anything.",
  "export.building": "Building\u2026",
  "export.confirm": "Export and download",
  "card.deactivated": "Deactivated",
  "card.qrOnCard": "on the printed card",
  "card.qrDrawing": "drawing\u2026",
  "card.qrFailed": "could not draw",

  // ------------------------------------------------------------- devices --
  "time.justNow": "just now",
  "device.kind.scanner": "Scanner",
  "device.kind.screen": "Screen",
  "device.kindInline.scanner": "scanner",
  "device.kindInline.screen": "screen",
  "devices.subtitleQuiet": "Guard phones and the lobby screen",
  "devices.silentOne": "{count} device has not checked in recently",
  "devices.silentMany": "{count} devices have not checked in recently",
  "devices.alertOne": "{count} device is silent.",
  "devices.alertMany": "{count} devices are silent.",
  "devices.alertBody":
    "A door with no scans in ten minutes is either quiet or offline \u2014 walk over and check.",
  "devices.paired": "Paired devices",
  "devices.pairedBody":
    "Refreshes on its own. \u201cLast seen\u201d is the last request a device made, so it is how you tell a quiet door from a dead phone.",
  "devices.loadFailed": "Could not load devices",
  "devices.none": "No devices paired yet",
  "devices.noneBody":
    "Generate a code above, then enter it on the guard\u2019s phone or the lobby screen.",
  "devices.col.device": "Device",
  "devices.col.kind": "Kind",
  "devices.col.lastSeen": "Last seen",
  "devices.col.state": "State",
  "devices.neverCheckedIn": "Never checked in",
  "devices.silentCheck": "Silent \u2014 check the door",
  "devices.notSeenSincePairing": "Not seen since pairing",
  "devices.stateRevoked": "REVOKED",
  "devices.stateActive": "ACTIVE",
  "devices.revoke": "Revoke",

  // ------------------------------------------------------------- pairing --
  "pair.title": "Pair a device",
  "pair.body":
    "Open the app on the phone or screen, then read it the code below. Each code works once.",
  "pair.codeButton": "{kind} code",
  "pair.blurb.scanner": "A guard\u2019s phone, at a door",
  "pair.blurb.screen": "The lobby display",
  "pair.codeLabel": "{kind} pairing code",
  "pair.expired":
    "This code has expired. Generate another \u2014 nothing was paired with it.",
  "pair.expiresIn": "Expires in",
  "pair.alphabetNote":
    "Codes never contain 0, O, 1 or I \u2014 those four are left out because they are the ones people mishear and mistype. The device appears in the list below the moment it pairs.",

  // ------------------------------------------------ revoke device dialog --
  "revokeDevice.title": "Revoke {name}?",
  "revokeDevice.body":
    "This {kind} stops working {strong}. If it is a door phone, that door cannot record arrivals until someone re-pairs it.",
  "revokeDevice.bodyStrong": "immediately",
  "revokeDevice.point1":
    "{strong} \u2014 within seconds, without anyone walking over to it. Have a new pairing code ready if you mean to bring it straight back.",
  "revokeDevice.point1Strong": "It drops back to its pairing screen on its own",
  "revokeDevice.point2":
    "Its token is dead. There is no un-revoke \u2014 getting it back means a new pairing code.",
  "revokeDevice.point3":
    "Scans it already recorded are kept, and any it saved offline will still sync once it is paired again.",
  "revokeDevice.point4":
    "It stays in this list, marked revoked, so the audit trail holds.",
  "revokeDevice.cancel": "Keep it active",
  "revokeDevice.pending": "Revoking\u2026",
  "revokeDevice.confirm": "Revoke device",
  "error.deviceLoad": "The device list could not be loaded.",
  "error.pairingCode": "A pairing code could not be generated.",
  "error.deviceRevoke": "The device could not be revoked.",

  // ------------------------------------------------------------- reports --
  "reports.title": "Entrance log",
  "reports.subtitleQuiet": "Arrivals and refusals",
  "reports.subtitleRefused": "{count} refused at the door",
  "reports.subtitleNoRefusals": "No badges refused in this range",
  "reports.allOutcomes": "All outcomes",
  "reports.allCategories": "All categories",
  "reports.from": "From",
  "reports.to": "To",
  "reports.outcome": "Outcome",
  "reports.any": "Any",
  "reports.exportNote":
    "Whatever the filters above are set to, exactly as shown.",
  "reports.preparing": "Preparing\u2026",
  "reports.exportFailed": "The export could not be saved.",
  "reports.logFailed": "Could not load the log",
  "reports.everyBadge": "Every badge presented",
  "reports.everyBadgeNote":
    "The rows behind the figures above, refusals included",
  "reports.timezone": "Times shown in {zone}.",
  "reports.format.pdf": "PDF report",
  "reports.format.pdfHint":
    "The written report \u2014 findings, charts and tables. For sending on.",
  "reports.format.xlsx": "Excel workbook",
  "reports.format.xlsxHint":
    "Six sheets, figures as numbers. For anyone who wants to pivot it.",
  "reports.format.csv": "CSV log",
  "reports.format.csvHint":
    "The raw scan log, one row per badge presented. No analysis.",
  "reports.export.stale":
    "That export is not available on the server yet \u2014 it is running an older build than this page. Restart the backend and try again.",
  "reports.export.expired":
    "Your session expired. Reload the page and sign in again.",
  "reports.export.serverError":
    "The server could not build that export (HTTP {status}).",
  "reports.export.downloadFailed":
    "That export could not be downloaded (HTTP {status}).",
  "error.reportLoad": "The entrance log could not be loaded.",

  // --------------------------------------------------------------- recap --
  "recap.unavailable": "Analysis unavailable",
  "recap.unavailableBody":
    "The server answered without the derived findings, which means it is running an older build than this page. Restart the backend and reload \u2014 the log below is unaffected and still accurate.",
  "recap.scans": "Scans",
  "recap.inRange": "In this range",
  "recap.people": "People",
  "recap.distinct": "Distinct visitors",
  "recap.duplicates": "Duplicates",
  "recap.reEntries": "Re-entries, not refusals",
  "recap.refused": "Refused",
  "recap.invalidOrRevoked": "Invalid or revoked",
  "recap.nothingScanned": "Nothing scanned in this range",
  "recap.nothingScannedBody":
    "Widen the dates, or clear the filters. There is nothing to report on yet.",
  "recap.attendance": "Attendance",
  "recap.attendanceNote": "{arrived} of {registered} registered",
  "recap.scansLogged": "Scans logged",
  "recap.repeatNote": "{count} people came through more than once",
  "recap.busiestHour": "Busiest hour",
  "recap.peakNote": "{total} scans \u00b7 {share}% of the period",
  "recap.noArrivals": "No arrivals recorded",
  "recap.refusalNote": "{rate}% of everything presented",
  "recap.noneTurnedAway": "No badge turned away",
  "recap.whatNumbersSay": "What the numbers say",
  "recap.whatNumbersSayNote":
    "Generated from this range \u2014 every line is a claim the data supports",
  "recap.loadByDoor": "Load by door",
  "recap.loadByDoorNote":
    "One door turning away badges is a door with a problem",
  "recap.noDoorScan": "No door recorded a scan.",
  "recap.refusedHere": "{count} refused here",
  "recap.notArrived": "Registered, not yet arrived",
  "recap.notArrivedCount": "{count} of {registered}",
  "recap.notArrivedNote":
    "No valid scan in this range. Full list is in the PDF and the workbook.",

  // ----------------------------------------------------------- entry log --
  "entry.emptyBody": "Widen the dates, or clear the filters.",
  "entry.col.time": "Time",
  "entry.col.name": "Name",
  "chart.noScans": "No scans in this range, so there is nothing to plot.",

  // ------------------------------------------------------------ overview --
  "overview.subtitleQuiet": "Today\u2019s arrivals across every door",
  "overview.silentOne": "{count} door has gone quiet \u2014 check Devices",
  "overview.silentMany": "{count} doors have gone quiet \u2014 check Devices",
  "overview.registered": "Registered",
  "overview.vipCount": "{count} VIP",
  "overview.arrivedToday": "Arrived today",
  "overview.arrivedNote": "{percent}% of those registered",
  "overview.refusedAtDoor": "Refused at the door",
  "overview.duplicateOne": "{count} duplicate scan not counted",
  "overview.duplicateMany": "{count} duplicate scans not counted",
  "overview.doorsReporting": "Doors reporting",
  "overview.silentCount": "{count} silent",
  "overview.allCheckedIn": "All checked in recently",
  "overview.arrivalsByHour": "Arrivals by hour",
  "overview.arrivalsByHourNote":
    "Every badge presented today, plotted where it happened",
  "overview.scanCountOne": "{count} scan",
  "overview.scanCountMany": "{count} scans",
  "overview.outcomeSplit": "Outcome split",
  "overview.outcomeSplitNote": "How today\u2019s scans divided",
  "overview.recentScans": "Recent scans",
  "overview.recentScansNote": "Newest first, refusals included",
  "overview.nothingToday": "Nothing has been scanned yet today.",
  "overview.arrivalsAppear":
    "Arrivals appear here the moment a guard scans a badge.",
  "overview.colVisitor": "Visitor",
  "overview.openLog": "Open the full entrance log \u2192",
  "overview.arrivedSummary.oneOne":
    "{people} person has arrived across {scans} scan.",
  "overview.arrivedSummary.oneMany":
    "{people} person has arrived across {scans} scans.",
  "overview.arrivedSummary.manyOne":
    "{people} people have arrived across {scans} scan.",
  "overview.arrivedSummary.manyMany":
    "{people} people have arrived across {scans} scans.",

  // --------------------------------------------------------------- brand --
  "brand.organisedBy": "Organised by {first} and {second}.",
  "brand.dates": "D\u00edli, 2\u20133 October 2026",
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
