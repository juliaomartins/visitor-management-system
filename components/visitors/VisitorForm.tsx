"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BadgeCard } from "@/components/badge-card";
import { PhotoUpload } from "@/components/visitors/PhotoUpload";
import type {
  FieldErrors,
  VisitorCategory,
  VisitorFormValues,
} from "@/lib/visitors";

const CATEGORIES: { value: VisitorCategory; label: string; note: string }[] = [
  { value: "normal", label: "Normal", note: "Standard badge" },
  { value: "vip", label: "VIP", note: "Distinct card and lobby welcome" },
];

/** Shown on the preview until the server assigns a real one. */
const PENDING_SERIAL = "— — — —";

export function VisitorForm({
  mode,
  initial,
  existingPhotoUrl,
  badgeSerial,
  submitting,
  formError,
  fieldErrors,
  onSubmit,
  cancelHref,
}: {
  mode: "create" | "edit";
  initial?: Partial<VisitorFormValues>;
  existingPhotoUrl?: string;
  /** Known when editing; on registration the server assigns it. */
  badgeSerial?: string;
  submitting: boolean;
  formError?: string;
  fieldErrors?: FieldErrors;
  onSubmit: (values: VisitorFormValues) => void;
  cancelHref: string;
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [organization, setOrganization] = useState(initial?.organization ?? "");
  const [category, setCategory] = useState<VisitorCategory>(
    initial?.category ?? "normal",
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [missingPhoto, setMissingPhoto] = useState(false);

  // The object URL is minted where the file arrives — in an event — and the old
  // one is released in the same breath. Without the revoke, registering fifty
  // visitors in a morning leaks fifty full-size bitmaps into the tab, on the
  // same laptop that is driving the print queue.
  const previewRef = useRef<string | null>(null);

  function handlePhoto(file: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = file ? URL.createObjectURL(file) : null;
    setPhoto(file);
    setPreviewUrl(previewRef.current);
  }

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // A badge without a photo is a badge nobody can check at the door.
    if (mode === "create" && !photo) {
      setMissingPhoto(true);
      return;
    }

    setMissingPhoto(false);
    onSubmit({
      full_name: fullName.trim(),
      country: country.trim(),
      organization: organization.trim(),
      category,
      photo,
    });
  }

  const fieldError = (name: string) => fieldErrors?.[name]?.[0];

  return (
    <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-[1fr_auto]">
      <div className="max-w-md space-y-5">
        <Field
          id="full_name"
          label="Full name"
          value={fullName}
          onChange={setFullName}
          error={fieldError("full_name")}
          required
          autoFocus
          hint="As it should read on the badge."
        />

        <Field
          id="country"
          label="Country"
          value={country}
          onChange={setCountry}
          error={fieldError("country")}
          required
        />

        <Field
          id="organization"
          label="Organisation"
          value={organization}
          onChange={setOrganization}
          error={fieldError("organization")}
          hint="Optional."
        />

        <fieldset>
          <legend className="text-xs font-medium text-ink-2">Category</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-md border px-3.5 py-3 transition-colors ${
                  category === option.value
                    ? "border-ink bg-ink/5"
                    : "border-line-strong hover:border-ink/40"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="category"
                    value={option.value}
                    checked={category === option.value}
                    onChange={() => setCategory(option.value)}
                    className="accent-ink"
                  />
                  <span className="text-sm font-medium text-ink">
                    {option.label}
                  </span>
                </span>
                <span className="mt-0.5 block pl-6 text-xs text-ink-3">
                  {option.note}
                </span>
              </label>
            ))}
          </div>
          {fieldError("category") ? (
            <p role="alert" className="mt-1.5 text-xs text-revoked">
              {fieldError("category")}
            </p>
          ) : null}
        </fieldset>

        {formError ? (
          <p
            role="alert"
            className="rounded-md bg-revoked-soft px-3 py-2.5 text-sm text-revoked"
          >
            {formError}
          </p>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-graphite-800 disabled:opacity-70"
          >
            {submitting
              ? mode === "create"
                ? "Registering…"
                : "Saving…"
              : mode === "create"
                ? "Register and issue badge"
                : "Save changes"}
          </button>

          <Link
            href={cancelHref}
            className="rounded-md px-3 py-2.5 text-sm text-ink-2 transition-colors hover:text-ink"
          >
            Cancel
          </Link>
        </div>
      </div>

      <div className="w-full lg:w-80">
        {/*
          The card, updating as the form is filled in. A name too long for the
          plate, a photo cropped through someone's chin, a VIP band that was
          meant to be there — all of it is visible here, before the card is
          printed and handed over.
        */}
        <p className="mono text-[10px] tracking-[0.22em] text-ink-3 uppercase">
          Card preview
        </p>
        <div className="mt-2">
          <BadgeCard
            visitor={{
              full_name: fullName || "Full name",
              country: country || "Country",
              organization,
              badge_serial: badgeSerial ?? PENDING_SERIAL,
              photo: previewUrl ?? existingPhotoUrl ?? "",
              category,
            }}
            width="100%"
            detail
          />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {mode === "create"
            ? "The serial and QR are assigned when you register."
            : "Editing details does not reissue the badge. The serial and the QR code stay exactly as printed."}
        </p>

        <div className="mt-6">
          <PhotoUpload
            onChange={handlePhoto}
            existingUrl={existingPhotoUrl}
            error={
              missingPhoto
                ? "A badge needs a photo. Add one before registering."
                : fieldError("photo")
            }
          />
        </div>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-2">
        {label}
        {required ? null : <span className="ml-1 text-ink-3">(optional)</span>}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        required={required}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`mt-1.5 w-full rounded-md border bg-card px-3 py-2.5 text-sm text-ink transition-colors ${
          error
            ? "border-revoked focus:border-revoked"
            : "border-line-strong focus:border-ink"
        }`}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-revoked">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
