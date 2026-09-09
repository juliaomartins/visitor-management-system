import { NextRequest } from "next/server";

import { resolveBackendTarget } from "@/lib/backend-target";

/**
 * A same-origin proxy to the backend, resolved fresh on every request.
 *
 * This replaces the `rewrites()` entry that used to carry `/api/*`. A rewrite
 * destination is fixed when the Next process boots, so it could not follow the
 * server's address the way the rest of the screen does — see lib/backend-target.
 *
 * Being same-origin is the other half of the job: `POST /devices/pair` sends
 * `Content-Type: application/json` and the feed sends `Authorization`, and both
 * of those trigger a CORS preflight when sent cross-origin. The backend answers
 * preflights with nothing at all — `django-cors-headers` is deliberately not
 * installed (CLAUDE.md). Through this route the browser never leaves its origin,
 * so no preflight is ever made.
 *
 * The WebSocket still goes direct: Next does not proxy upgrade requests, and
 * sockets are not subject to CORS. See lib/api.ts.
 */
export const dynamic = "force-dynamic";

/** Long enough for a slow LAN, short enough that a kiosk is not left hanging. */
const TIMEOUT_MS = 10_000;

/** Hop-by-hop and body-framing headers must not be copied onto a new request. */
const FORWARDED_REQUEST_HEADERS = ["authorization", "content-type", "accept"];

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const target = resolveBackendTarget(request.headers);

  const url = new URL(`/api/${path.join("/")}`, target);
  url.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      signal: controller.signal,
      cache: "no-store",
      redirect: "manual",
    });

    const body = await upstream.text();

    return new Response(body || null, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    /*
      Name the address that actually failed.

      The old failure said "could not reach <the address the page probed>" while
      the request had quietly gone somewhere else entirely, which sent whoever
      was standing at the kiosk to check a network that was working fine. What
      the person needs is the address this request was really sent to.
    */
    return Response.json(
      {
        detail: `Could not reach the VMS backend at ${target}. The server may be switched off, or on a different network than this display.`,
        backend: target,
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  } finally {
    clearTimeout(timer);
  }
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
