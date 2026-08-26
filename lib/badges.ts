/**
 * Badge PDFs.
 *
 * Two endpoints, and the difference between them is the whole story of this
 * feature:
 *
 *   POST /badges/card           needs the RAW token. Non-destructive.
 *   POST /badges/reissue-sheet  needs only ids. DESTRUCTIVE — mints new tokens.
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
  await ensureAccessToken();

  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // 503 is the one worth reading aloud: the server is fine, WeasyPrint just
    // cannot load its native libraries. Pass the server's own words through.
    const detail = await response
      .json()
      .then((payload) => payload?.detail as string | undefined)
      .catch(() => undefined);

    throw new ApiError(
      detail ?? `The badge could not be rendered (HTTP ${response.status}).`,
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
export async function downloadReissuedSheet(visitorIds: string[]): Promise<void> {
  return fetchPdf(
    "/api/v1/badges/reissue-sheet",
    { visitor_ids: visitorIds },
    `badge-sheet-${visitorIds.length}.pdf`,
  );
}
