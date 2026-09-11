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
 * Fetch a binary file with the bearer token and hand it to the browser.
 *
 * A plain `<a href>` would carry no Authorization header and simply 401, which is
 * why every download in this app goes through a blob.
 */
async function download(path: string, fallbackName: string, body?: unknown) {
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

  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = named ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
  return download("/api/v1/badges/roster.xlsx", "vms-roster.xlsx");
}

/**
 * DESTRUCTIVE. A spreadsheet with a scannable QR beside every visitor, which is
 * only possible by minting each of them a new token — so every card already
 * printed for the people in this file stops working.
 *
 * Omit `visitorIds` to take everyone still registered.
 */
export async function downloadCredentialExport(
  visitorIds?: string[],
): Promise<void> {
  const count = visitorIds?.length;
  return download(
    "/api/v1/badges/export",
    count ? `vms-credentials-${count}.xlsx` : "vms-credentials.xlsx",
    visitorIds && visitorIds.length > 0 ? { visitor_ids: visitorIds } : {},
  );
}
