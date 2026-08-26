/**
 * Visitor reads and writes.
 *
 * Every mutation calls `ensureAccessToken()` first. The client replays a GET that
 * comes back 401, but a request with a body cannot be replayed once it has been
 * sent — so a write asks for a live token up front rather than failing after the
 * registrar has already filled in the form.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { components } from "@vms/contracts";
import { ensureAccessToken } from "@/lib/auth";
import { queryKeys } from "@/lib/query-client";

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

function fail(error: unknown, fallback: string): never {
  if (error && typeof error === "object") {
    const body = error as Record<string, unknown>;

    if (typeof body.detail === "string") throw new ApiError(body.detail);

    const fields: FieldErrors = {};
    for (const [key, value] of Object.entries(body)) {
      if (Array.isArray(value)) fields[key] = value.map(String);
      else if (typeof value === "string") fields[key] = [value];
    }
    if (Object.keys(fields).length > 0) {
      throw new ApiError("Some fields need attention.", fields);
    }
  }

  throw new ApiError(fallback);
}

export function useVisitor(id: string) {
  return useQuery({
    queryKey: queryKeys.visitor(id),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/visitors/{id}", {
        params: { path: { id } },
        signal,
      });
      if (error) fail(error, "That visitor could not be loaded.");
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

      if (error) fail(error, "The visitor could not be registered.");
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
    mutationFn: async (values: VisitorFormValues): Promise<VisitorDetail> => {
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

      if (error) fail(error, "The changes could not be saved.");
      return data as VisitorDetail;
    },
    onSuccess: (visitor) => {
      queryClient.setQueryData(queryKeys.visitor(id), visitor);
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
    },
  });
}

export function useRevokeVisitor(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await ensureAccessToken();

      const { data, error } = await api.POST("/api/v1/visitors/{id}/revoke", {
        params: { path: { id } },
      });

      if (error) fail(error, "The badge could not be revoked.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visitor(id) });
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
    },
  });
}
