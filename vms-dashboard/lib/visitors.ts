/**
 * Visitor reads and writes.
 *
 * Every mutation calls `ensureAccessToken()` first. The client replays a GET that
 * comes back 401, but a request with a body cannot be replayed once it has been
 * sent — so a write asks for a live token up front rather than failing after the
 * registrar has already filled in the form.
 */
import {
  DEFAULT_LOCALE,
  translate,
  type MessageKey,
} from "@/lib/locales";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { components } from "@vms/contracts";
import { ensureAccessToken } from "@/lib/auth";
import { queryKeys } from "@/lib/query-client";

export type Visitor = components["schemas"]["Visitor"];
export type VisitorDetail = components["schemas"]["VisitorDetail"];
export type VisitorIssued = components["schemas"]["VisitorIssued"];
export type ScanEvent = components["schemas"]["ScanEvent"];
export type ScanResult = components["schemas"]["ResultEnum"];
export type VisitorCategory = components["schemas"]["CategoryEnum"];

export type VisitorFormValues = {
  full_name: string;
  country: string;
  organization: string;
  category: VisitorCategory;
  /** Absent on edit means "keep the photo already on file". */
  photo?: File | null;
};

/** DRF returns `{ field: ["message"] }` on a 400. */
export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly fields: FieldErrors = {},
    /**
     * Set when the sentence is ours; absent when the backend supplied it.
     *
     * These are thrown from query and mutation functions, outside any component,
     * so they cannot translate themselves. `useErrorText` resolves the key at
     * the point of display. A backend `detail` arrives with no key and is shown
     * as it came - Django is not translated, and inventing a Tetun sentence for
     * a server error we did not write would be a guess about what went wrong.
     */
    readonly key?: MessageKey,
  ) {
    super(message);
  }
}

/**
 * The photo is a file, so these go as multipart rather than JSON.
 *
 * Content-Type is explicitly removed: the browser has to set it itself to attach
 * the multipart boundary, and a hand-set header has no boundary in it.
 */
function toFormData(body: unknown): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    form.append(key, value instanceof Blob ? value : String(value));
  }

  return form;
}

const MULTIPART = {
  bodySerializer: toFormData,
  headers: { "Content-Type": null },
} as const;

function fail(error: unknown, fallback: MessageKey): never {
  if (error && typeof error === "object") {
    const body = error as Record<string, unknown>;

    if (typeof body.detail === "string") throw new ApiError(body.detail);

    const fields: FieldErrors = {};
    for (const [key, value] of Object.entries(body)) {
      if (Array.isArray(value)) fields[key] = value.map(String);
      else if (typeof value === "string") fields[key] = [value];
    }
    if (Object.keys(fields).length > 0) {
      throw new ApiError(
        translate(DEFAULT_LOCALE, "error.fields"),
        fields,
        "error.fields",
      );
    }
  }

  throw new ApiError(translate(DEFAULT_LOCALE, fallback), {}, fallback);
}

export function useVisitor(id: string) {
  return useQuery({
    queryKey: queryKeys.visitor(id),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/visitors/{id}", {
        params: { path: { id } },
        signal,
      });
      if (error) fail(error, "error.visitorLoad");
      return data;
    },
  });
}

export function useRegisterVisitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: VisitorFormValues): Promise<VisitorIssued> => {
      await ensureAccessToken();

      const { data, error } = await api.POST("/api/v1/visitors", {
        ...MULTIPART,
        body: {
          full_name: values.full_name,
          country: values.country,
          organization: values.organization,
          category: values.category,
          // Typed `string` because the schema calls it binary; it is a File.
          photo: values.photo as unknown as string,
        },
      });

      if (error) fail(error, "error.visitorRegister");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
    },
  });
}

export function useUpdateVisitor(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: VisitorFormValues): Promise<Visitor> => {
      await ensureAccessToken();

      const body: Record<string, unknown> = {
        full_name: values.full_name,
        country: values.country,
        organization: values.organization,
        category: values.category,
      };
      // Omitted entirely when unchanged — sending an empty value would clear it.
      if (values.photo) body.photo = values.photo;

      const { data, error } = await api.PATCH("/api/v1/visitors/{id}", {
        ...MULTIPART,
        params: { path: { id } },
        body: body as never,
      });

      if (error) fail(error, "error.visitorSave");
      return data;
    },
    onSuccess: (updated) => {
      /*
       * MERGE, never replace.
       *
       * PATCH answers with a `Visitor` — no `scan_events`, because the edit
       * endpoint has no reason to send a scan history back. Writing that straight
       * into the detail cache replaced a `VisitorDetail` with something missing a
       * field the detail page reads, and the page crashed on
       * `visitor.scan_events.filter(...)` until a reload refetched the full shape.
       *
       * Spreading over the previous entry keeps the history and takes the edited
       * fields. The invalidate then reconciles with the server, so the merge only
       * has to be right for the moment between the two.
       */
      queryClient.setQueryData<VisitorDetail>(queryKeys.visitor(id), (previous) =>
        previous ? { ...previous, ...updated } : previous,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.visitor(id) });
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
    },
  });
}

/**
 * Switch a visitor off, and back on again.
 *
 * NEITHER OF THESE TOUCHES THE BADGE TOKEN, which is the whole reason they are
 * a pair. The backend reads `is_active` at scan time rather than anything baked
 * into the QR, so a visitor switched off stops scanning and a visitor switched
 * back on resumes with the card already in their hand. Nothing is reprinted and
 * nothing is reissued.
 *
 * They are separate mutations rather than one taking a boolean so that each
 * lands in the server's audit log under its own name.
 */
export function useDeactivateVisitor(id: string) {
  return useVisitorStateChange(id, "deactivate");
}

export function useActivateVisitor(id: string) {
  return useVisitorStateChange(id, "activate");
}

function useVisitorStateChange(id: string, action: "activate" | "deactivate") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await ensureAccessToken();

      const path =
        action === "activate"
          ? ("/api/v1/visitors/{id}/activate" as const)
          : ("/api/v1/visitors/{id}/deactivate" as const);

      const { data, error } = await api.POST(path, {
        params: { path: { id } },
      });

      if (error) {
        fail(
          error,
          action === "activate"
            ? "error.visitorActivate"
            : "error.visitorDeactivate",
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visitor(id) });
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
    },
  });
}

/**
 * Erase a registration for good.
 *
 * THE ONLY IRREVERSIBLE ACTION IN THE DASHBOARD. It drops the row and the
 * visitor's photo from the server; scans of that badge survive but stop naming
 * anybody, and the response says how many were affected so the caller can
 * report it.
 *
 * The visitor's own cache entry is removed rather than invalidated — refetching
 * an id that no longer exists would only produce a 404 and an error card.
 */
export function usePurgeVisitor(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await ensureAccessToken();

      const { data, error } = await api.DELETE(
        "/api/v1/visitors/{id}/permanent",
        { params: { path: { id } } },
      );

      if (error) fail(error, "error.visitorDelete");
      return data;
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.visitor(id) });
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
    },
  });
}
