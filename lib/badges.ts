/**
 * Badge PDFs.
 *
 * Two endpoints, and the difference between them is the whole story of this
 * feature:
 *
 *   POST /badges/card           needs the RAW token. Non-destructive.
 *   GET  /badges/roster.xlsx    the visitor list. Non-destructive.
 *   POST /badges/reissue-sheet  needs only ids. DESTRUCTIVE — mints new tokens.
 *   POST /badges/export         .xlsx with QR. DESTRUCTIVE — mints new tokens.
 *
 * The raw token exists for exactly one moment: the response to `POST /visitors`.
 * Only its SHA-256 digest is stored, so the server cannot reprint a card it
 * issued earlier — it can only issue a new one. That is why the registration
 * receipt can hand you a PDF for free, and why every later print is a reissue
 * that kills the card the visitor is already wearing.
 *
 * Both are fetched with the bearer token and handed to the browser as a blob. A
 * plain `<a href>` would carry no Authorization header and simply 401.
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
 * DESTRUCTIVE. Every listed visitor gets a new token, and any card already
 * printed for them stops scanning the moment this returns.
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
 * No QR column, and it cannot have one: the server keeps `sha256(token)` and
 * throws the raw value away, so it cannot reproduce the code on a card it has
 * already printed. Use `downloadCredentialExport` when a QR is actually needed
 * and the reissue is acceptable.
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

export type ReissuedBadge = {
  visitor_id: string;
  badge_serial: string;
  full_name: string;
  category: string;
  token: string;
};

/**
 * DESTRUCTIVE. Reissue the listed visitors and get their RAW tokens back, so the
 * dashboard can draw a working QR on screen.
 *
 * The reissue is not a design choice: the server keeps only `sha256(token)`, so
 * the code on a card it printed last week cannot be recovered — only replaced.
 * Every card already in the hands of these visitors stops scanning.
 *
 * The response is the only copy. It is held in component state and never stored.
 */
export async function reissueBadges(
  visitorIds: string[],
): Promise<ReissuedBadge[]> {
  await ensureAccessToken();

  const response = await fetch("/api/v1/badges/reissue", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ visitor_ids: visitorIds }),
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((payload) => payload?.detail as string | undefined)
      .catch(() => undefined);
    throw new ApiError(
      detail ?? `The badges could not be reissued (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json()) as { issued: ReissuedBadge[] };
  return payload.issued;
}
