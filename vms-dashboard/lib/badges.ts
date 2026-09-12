/**
 * Badge PDFs and exports.
 *
 * EVERY ENDPOINT HERE IS NON-DESTRUCTIVE, AND THAT IS THE WHOLE STORY:
 *
 *   POST /badges/card           needs the RAW token.
 *   GET  /badges/roster.xlsx    the visitor list, with photo and live QR.
 *   POST /badges/reissue-sheet  needs only ids. Draws the A4 sheet.
 *   POST /badges/export         .xlsx with the QR for each visitor.
 *
 * A badge token is derived — `hmac(secret, id:token_version)` — so the server
 * can reproduce the code on a card it printed weeks ago. Printing redraws what
 * is already round somebody's neck; it never mints a replacement, and nothing
 * a registrar does from the dashboard changes a QR.
 *
 * `POST /badges/reissue` DOES rotate tokens and is deliberately not wrapped
 * here. A badge is issued once at registration and stays valid until the
 * visitor is deactivated or deleted, so the dashboard has no button for it and
 * no client function that could grow one by accident.
 *
 * All of these are fetched with the bearer token and handed to the browser as a
 * blob. A plain `<a href>` would carry no Authorization header and simply 401.
 */
import { ensureAccessToken, getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/visitors";

async function fetchPdf(path: string, body: unknown, fallbackName: string) {
  return download(path, fallbackName, body);
}

/**
 * Today as `YYYY-MM-DD`, for the FALLBACK filenames only.
 *
 * THE SERVER IS AUTHORITATIVE. It sends the real name in `Content-Disposition`
 * and `download` below prefers it; this exists so that the one path where the
 * header is missing or unparseable still produces a dated file instead of a
 * bare stem. It is deliberately the same shape and deliberately not the same
 * clock: the server dates in Asia/Dili, this dates in the browser's zone. On a
 * closed LAN at one venue those agree, and where they did not, the server's
 * name is the one that lands.
 */
function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

type FetchedFile = { blob: Blob; name: string };

/**
 * Fetch a binary file with the bearer token.
 *
 * A plain `<a href>` would carry no Authorization header and simply 401, which is
 * why every download in this app goes through a blob.
 *
 * Split from `save` so that PRINTING makes exactly the request downloading does:
 * the same sign-in step, the same error wording, the same server-named file. The
 * receipt puts the two buttons side by side, and they must not fail differently.
 */
async function fetchFile(
  path: string,
  fallbackName: string,
  body?: unknown,
): Promise<FetchedFile> {
  await ensureAccessToken();

  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ""}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    // 503 is the one worth reading aloud: the server is fine, WeasyPrint just
    // cannot load its native libraries. Pass the server's own words through.
    const detail = await response
      .json()
      .then((payload) => payload?.detail as string | undefined)
      .catch(() => undefined);

    throw new ApiError(
      detail ??
        (response.status === 404
          ? "That endpoint is not available on the server yet — it is running " +
            "an older build than this page. Restart the backend and try again."
          : `The badge could not be rendered (HTTP ${response.status}).`),
    );
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const named = /filename="?([^";]+)"?/.exec(disposition)?.[1];

  return { blob: await response.blob(), name: named ?? fallbackName };
}

/** Hand a fetched file to the browser as a download. */
function save({ blob, name }: FetchedFile) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function download(path: string, fallbackName: string, body?: unknown) {
  save(await fetchFile(path, fallbackName, body));
}

/** The free print: the receipt still holds the token, so nothing is reissued. */
export async function downloadBadgeCard(
  rawToken: string,
  badgeSerial: string,
): Promise<void> {
  return fetchPdf(
    "/api/v1/badges/card",
    { token: rawToken },
    `badge-${badgeSerial}.pdf`,
  );
}

/**
 * Open one badge in the browser's own PDF viewer, in a new tab, ready to print.
 *
 * This is the `/badges` route to the printer, minus the trip to the downloads
 * folder: `/badges` hands over the PDF, the registrar opens it in the viewer and
 * presses its printer icon, and that is the path confirmed to come out at card
 * size on the CR80 printer. The PDF is the same page, too -- `/badges` for one
 * visitor calls `render_a4_sheet_pdf`, whose single-visitor branch IS
 * `render_card_pdf`, measured at 1 page, 54.0 x 85.6 mm, pixel difference 0.0.
 *
 * IT REPLACED PRINTING FROM AN INVISIBLE IFRAME, and the reason is the printer,
 * not the code. `print()` on a hidden frame hands the page straight to the print
 * dialog, which is the one step headless testing cannot see and the one step
 * that decides paper size. The viewer is the path people already trust.
 *
 * THE TAB IS OPENED BEFORE THE REQUEST, on purpose. Pop-up blockers allow
 * `window.open` only while the click is still the current user gesture, and an
 * `await` ends that. Opening after the PDF arrives would be blocked on most
 * browsers every time, so the tab opens first with a placeholder and is pointed
 * at the PDF once it exists.
 *
 * Returns what happened, so the receipt can say it:
 *   "opened"     the viewer tab is showing the card
 *   "downloaded" pop-ups were blocked, so the file was saved as /badges does
 *   "cancelled"  the registrar closed the tab before the card arrived
 * A server or network failure closes the tab and throws, with the same message
 * Download would show.
 */
export async function openBadgeCard(
  rawToken: string,
  badgeSerial: string,
  placeholder: string,
): Promise<"opened" | "downloaded" | "cancelled"> {
  const tab = window.open("", "_blank");
  if (tab) {
    try {
      tab.document.title = badgeSerial;
      tab.document.body.style.font = "14px system-ui, sans-serif";
      tab.document.body.textContent = placeholder;
    } catch {
      // Cosmetic only; the tab is still ours to navigate.
    }
  }

  let file: FetchedFile;
  try {
    file = await fetchFile(
      "/api/v1/badges/card",
      `badge-${badgeSerial}.pdf`,
      { token: rawToken },
    );
  } catch (error) {
    // An empty tab left saying "Rendering…" forever is worse than no tab.
    tab?.close();
    throw error;
  }

  if (!tab) {
    save(file);
    return "downloaded";
  }

  // Closing the placeholder was a decision; a download would override it.
  if (tab.closed) return "cancelled";

  // The viewer needs to be told this is a PDF. The server says so today; a
  // missing header would otherwise show the bytes as text.
  const pdf =
    file.blob.type === "application/pdf"
      ? file.blob
      : new Blob([file.blob], { type: "application/pdf" });

  /*
    NOT REVOKED. The viewer in the other tab may read the blob again -- to
    print, to save, on a reload -- and a revoked URL fails there with nothing
    on the receipt to explain it. It is released when this page unloads; one
    card-sized PDF per registration is the whole cost.
  */
  tab.location.href = URL.createObjectURL(pdf);
  return "opened";
}

/**
 * The A4 print sheet. NOT destructive any more.
 *
 * Badge tokens are derived from the visitor, so this draws the QR that is
 * already on their card. Printing the same people twice produces two identical,
 * working sheets -- which is the point: a reprint used to be impossible.
 */
export async function downloadReissuedSheet(
  visitorIds: string[],
): Promise<void> {
  return fetchPdf(
    "/api/v1/badges/reissue-sheet",
    { visitor_ids: visitorIds },
    `badge-sheet-${visitorIds.length}.pdf`,
  );
}

/**
 * The visitor roster as a spreadsheet. Reads only — nothing is reissued.
 *
 * Row number, photograph, name, badge QR, country, organisation, registered.
 * The QR is the one already on that visitor's card: tokens are derived, so the
 * server can redraw a code it issued weeks ago without replacing it.
 *
 * Which makes this a file of working badges. `downloadCredentialExport` is
 * still the one to reach for when an outside card producer needs fresh tokens
 * and every current card is being replaced — that one is destructive; this one
 * is not.
 */
export async function downloadRoster(): Promise<void> {
  return download("/api/v1/badges/roster.xlsx", `visitors-${today()}.xlsx`);
}

/**
 * The card producer's sheet: every registered field, the photograph, the QR and
 * its payload as text, laid out with the same banner as the roster.
 *
 * NOT DESTRUCTIVE, and this comment said it was — four lines under a header on
 * this same file announcing that every endpoint here is non-destructive. The
 * token is derived, so `collect_badge_tokens` recomputes the code already on
 * the card; exporting retires nothing and exporting twice gives an identical
 * file. `POST /badges/reissue` is still the only thing that rotates, and it is
 * still deliberately not wrapped here.
 *
 * It does hand over working credentials, which is what the confirmation dialog
 * in front of it is for — and that dialog already said the right thing while
 * this comment did not.
 *
 * Omit `visitorIds` to take everyone still registered.
 */
export async function downloadCredentialExport(
  visitorIds?: string[],
): Promise<void> {
  /*
    The server decides the real name, including the single-visitor one: it has
    the visitor and can fold an accented name to ASCII, which is not worth
    reimplementing here for a fallback. So this mirrors only the shape, and the
    count case, and leaves the name to the header.
  */
  const count = visitorIds?.length ?? 0;
  const stem = `visitors-badges-${today()}`;
  return download(
    "/api/v1/badges/export",
    count > 1 ? `${stem}-${count}-visitors.xlsx` : `${stem}.xlsx`,
    count > 0 ? { visitor_ids: visitorIds } : {},
  );
}
