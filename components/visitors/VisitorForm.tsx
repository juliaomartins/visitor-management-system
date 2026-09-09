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
  registeredAt,
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
  /** Known when editing. On registration the card will carry today's date. */
  registeredAt?: string;
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
    /*
      THE PHOTO IS THE FIRST THING, NOT THE LAST.

      It used to sit in the right-hand rail underneath the card preview, in a
      256px column and below the fold — so the registrar filled in three text
      fields, hit register, and only then discovered the badge had no photo. The
      visitor is standing at the desk for about ninety seconds and the photo is
      the only part of this form that needs them present, so it goes first and it
      gets the width.
    */
    <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="max-w-lg space-y-6">
        <div className="card p-5">
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
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-2xl px-4 py-3.5 transition-colors ${
                  category === option.value
                    ? "bg-graphite-950 text-white"
                    : "bg-card-2 hover:bg-line"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="category"
                    value={option.value}
                    checked={category === option.value}
                    onChange={() => setCategory(option.value)}
                    className="accent-accent"
                  />
                  <span
                    className={`text-sm font-medium ${
                      category === option.value ? "text-white" : "text-ink"
                    }`}
                  >
                    {option.label}
                  </span>
                </span>
                <span
                  className={`mt-0.5 block pl-6 text-xs ${
                    category === option.value ? "text-graphite-300" : "text-ink-3"
                  }`}
                >
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
            className="rounded-2xl bg-revoked-soft px-4 py-3 text-sm text-revoked"
          >
            {formError}
          </p>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary disabled:opacity-70"
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
            className="btn btn-ghost"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* Sticky, so the card stays in view while the fields are filled in. On a
          laptop at a registration desk the form is taller than the screen. */}
      <div className="w-full lg:sticky lg:top-6 lg:w-64 lg:self-start">
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
              created_at: registeredAt ?? new Date().toISOString(),
            }}
            width="100%"
            detail
          />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {mode === "create"
            ? "The serial is assigned when you register. The QR is generated at the same moment and never changes afterwards."
            : "Editing details does not reissue the badge. The serial and the QR code stay exactly as printed."}
        </p>
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
        className={`field mt-1.5 ${
          error
            ? "bg-revoked-soft"
            : "bg-card-2 focus:bg-white"
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
