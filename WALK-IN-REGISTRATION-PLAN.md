# Walk-in Registration — Plan for Discussion

**Status:** proposal only. No code has been written.
**Date:** 13 September 2026
**Event:** DRCC and Ministerial Dialogue 2026, Díli, 2–3 October 2026

---

## 1. Summary

We want visitors who were **not registered in advance** to register themselves at
the event on 2 and 3 October.

The idea:

- A new registration page that does **not** need a login.
- The visitor fills in their details and takes a photo.
- They receive their badge after registering.
- A switch in **Settings** turns the page on during the event and off after it.

This document explains two decisions the team needs to make, the recommended
answer for each, and the security points to plan for.

**Recommendation in one line:** a **kiosk at reception**, and badges that only
work **after a receptionist approves** the visitor.

---

## 2. How registration works today

1. An admin logs in to the dashboard.
2. The admin types the visitor's details and uploads a photo.
3. The system creates the badge with a QR code.
4. The badge is printed and handed to the visitor.
5. The guard scans the QR at the door, and the lobby screen welcomes the visitor.

Every badge today exists because an admin created it. The new page would change
that, which is why the decisions below matter.

---

## 3. The main risk

The biggest danger is **not** a network attack. It is giving a **working badge**
to anyone who fills in a form.

- The QR code on a badge opens the door.
- The guard's scanner cannot tell a checked visitor from an unchecked one.
- The venue has no internet, so we cannot check a visitor by email or SMS.
- A badge PDF on a phone can be screenshotted and sent to someone else.
- This is a ministerial event with VIP guests.

The only real way to check a stranger is **a person looking at them**.

---

## 4. Decision 1 — Where do visitors fill in the form?

### Option A: A kiosk at reception (recommended)

A **kiosk** is a tablet or laptop that belongs to us. It sits on the reception
desk and only shows the registration form.

How it works:

1. The visitor walks to the desk.
2. They type their details on the tablet and take a photo.
3. A receptionist is nearby to help.

| Good | Not so good |
|---|---|
| Only **our** device joins our network | One or two people register at a time |
| Strangers' phones never reach the server | A small queue may form |
| We can see any problem, because the tablet is in front of us | We need to prepare the tablet(s) |

### Option B: Visitors use their own phones

A poster with a QR code on the wall. Visitors scan it, join the event Wi-Fi, and
fill in the form on their own phone.

| Good | Not so good |
|---|---|
| Many people can register at the same time | Every phone must join **our** Wi-Fi |
| No queue | Once on our Wi-Fi, a phone is **inside** our network — next to the server, the admin login and the scanners |
| | We do not know these phones; one could have bad software or belong to an attacker |

**If the team chooses Option B,** we need a **separate guest Wi-Fi** that can
only reach the registration page, and the guards' phones must stay on a
different network.

**Simple picture:** a kiosk is like letting people write in **our** notebook at
our desk. Own phones is like giving everyone a key to the office so they can
reach the notebook.

---

## 5. Decision 2 — When does the badge start working?

### Option A: Receptionist approves first (recommended)

How it works:

1. The visitor fills in the form.
2. The system saves them as **waiting**. Their badge does **not** open the door yet.
3. The screen says: *"Thank you. Please go to the reception desk."* and shows a
   short reference code.
4. The receptionist sees the new visitor in a **Walk-ins** list on the dashboard.
5. The receptionist checks the person (for example, their ID card) and presses
   **Approve**.
6. The badge prints on the card printer. **Now** it works at the door.

**Why it is safer:** a real person checks every visitor before they get a
working badge. Nobody can create a working badge from outside the desk.

### Option B: Badge works immediately

How it works:

1. The visitor fills in the form.
2. They get the badge PDF straight away.
3. The QR opens the door right away.

**Why it is riskier:**

- **Anyone** who can open the form gets a working badge, even with a fake name or
  someone else's photo.
- The guard cannot tell who was checked.
- The PDF can be shared by screenshot or message.
- A phone cannot print on the CR80 card printer anyway, so the visitor still has
  to come to the desk for a real card.

**Simple picture:** approval is like a hotel. You fill in the form, but the
receptionist checks your ID before giving you the room key.

If the team still wants visitors to receive the PDF themselves, it should only be
available **after approval**, and only once.

---

## 6. Recommended flow (kiosk + approval)

```
Visitor fills in the form on the kiosk
        │
        ▼
Saved as "waiting" — the badge does NOT scan yet
        │
        ▼
Kiosk shows: "Thank you — go to the reception desk. Reference: K7F-2Q"
Kiosk clears the form for the next visitor
        │
        ▼
Receptionist opens "Walk-ins" in the dashboard
Checks the visitor's ID  ──►  Approve
        │
        ▼
Print badge on the CR80 card printer  ──►  badge now works at the door
```

The visitor saves the receptionist time by typing their own details and taking
their own photo. The receptionist stays in control of who gets in.

---

## 7. The on/off switch in Settings

A switch that opens and closes walk-in registration.

| Rule | Why |
|---|---|
| **The server enforces it**, not only the dashboard page | Hiding the page is not enough; a closed form must refuse requests on the server |
| **Automatic opening hours as well as the switch** (for example 2 Oct 07:00 – 3 Oct 18:00, Díli time) | A forgotten switch does not leave registration open overnight or after the event |
| **Only admins can change it**, and every change is recorded with who and when | We know who opened or closed it |
| **Live numbers beside the switch**: walk-ins waiting, registrations in the last hour | A flood of fake sign-ups is easy to see |

**Note:** the system has nowhere to store settings today. Adding this needs a
small new settings table in the database.

---

## 8. Security plan

### 8.1 DDoS and flooding

- **A real DDoS attack comes from the internet.** Our server is on a closed
  network, so this is unlikely. We must confirm the router has **no port
  forwarding** and **UPnP is off** for ports 8000 and 3000.
- **The realistic risk is one device sending thousands of fake registrations.**
  This matters more for us than usual: the server runs as **one process**, and
  the same process handles the guards' scans. A flood could slow down the door.

Protections:

- **Limits on how many registrations are accepted.** One limit per device and one
  **total** limit (for example 60 per hour). The total limit protects the server
  even if many devices share one network address.
- **A maximum number of waiting walk-ins** (for example 100). Registration pauses
  until reception catches up.
- **Strict photo rules:** small maximum file size, JPEG or PNG only, a real image
  check, and a size limit on the picture.
- **No badge PDF creation on the public page.** Creating a PDF is the heavy step;
  with approval it only happens at the desk.
- **Simple bot traps that work without internet:** a hidden field that only bots
  fill in, and rejecting forms submitted too fast. (reCAPTCHA and hCaptcha need
  internet, so they will not work at the venue.)
- **Optional:** a web server such as nginx in front of the backend can add extra
  limits. It can be installed normally — no Docker needed.

### 8.2 XSS and injection

**XSS** is when someone types code instead of a name, hoping it runs on another
person's screen. The dashboard is built with React, which blocks the common cases
automatically. The places to check are where a visitor's name travels:

- **Excel exports.** A "name" like `=HYPERLINK(...)` can become a working formula
  when someone opens the spreadsheet. This is the most likely real attack.
  Reject names that start with `=`, `+`, `-` or `@`, or make them safe when
  exporting.
- **The lobby screen.** It animates visitor names. We should check the names are
  always shown as plain text.
- **Photos.** The server should re-save every uploaded photo. This removes hidden
  content and the GPS location that phones add to pictures. Never accept SVG
  files.
- **Input rules:** name length limits, remove invisible characters, and add a
  Content-Security-Policy header to the web pages.

### 8.3 Other risks

- **Protect the admin login.** When public devices can reach the server, someone
  may try to guess passwords. Add a limit on failed login attempts.
- **Clean the kiosk after every visitor.** Reset the form after success or after
  about a minute with no activity. Keep nothing saved in the browser. Do not
  download PDFs onto the kiosk, or the previous visitor's badge stays in the
  Downloads folder.
- **Privacy.** Show a short consent line, for example: *"Your photo and details
  are used for event access and deleted after the event."* Visitors get a
  registration record only — **no login account**.
- **Do not reveal who is registered.** A message like "this name is already
  registered" tells a stranger who is attending.
- **Taking photos works without HTTPS.** A normal photo upload button opens the
  tablet or phone camera on our plain `http://` network, and the existing photo
  cropper still works.

---

## 9. What would need to be built (rough scope)

A rough list for estimating. The exact design comes after the team decides.

- A public registration page, allowed without login.
- A server endpoint for walk-in registration, with the limits in section 8.
- A **waiting** state for walk-in visitors, whose badge does not scan until approved.
- A **Walk-ins** list in the dashboard, with **Approve** and **Reject** buttons.
- The Settings switch, opening hours and live numbers (plus the new settings table).
- Kiosk behaviour: reset after success, reset when idle, reference code screen.
- The security items in section 8, including the Excel export fix and the login limit.
- Texts in **English, Portuguese and Tetun**, like the rest of the dashboard.

---

## 10. Timing

- Today is **13 September**. The event is **2–3 October**.
- The **LAN dress rehearsal** with real phones, the real router and real printed
  cards has **not started** yet.
- This feature adds a new public entry point three weeks before the event.

**Advice:** keep the first version small and include walk-in registration in the
dress rehearsal. If time runs short, the receptionist can still register
walk-ins in the existing dashboard exactly as today.

---

## 11. Questions for the team

- [ ] **Decision 1:** kiosk at reception, or visitors' own phones?
- [ ] **Decision 2:** receptionist approval, or badges working immediately?
- [ ] What opening hours should walk-in registration have on each day?
- [ ] What ID should the receptionist check before approving?
- [ ] Who is allowed to approve walk-ins?
- [ ] Which details do we collect? (Name, country, organisation, photo — anything else?)
- [ ] What is the maximum number of walk-ins we expect per day?
- [ ] How many kiosk tablets or laptops can we provide?
- [ ] If own phones are chosen: can we set up a separate guest Wi-Fi?
- [ ] Who writes and checks the consent text in Portuguese and Tetun?

---

## 12. Next steps

1. The team discusses this document and answers section 11.
2. A detailed design is written from those answers and approved.
3. The feature is built and tested.
4. Walk-in registration is tested during the LAN dress rehearsal.
