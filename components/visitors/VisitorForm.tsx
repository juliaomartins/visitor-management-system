"use client";

import Link from "next/link";
import { useState } from "react";

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

export function VisitorForm({
  mode,
  initial,
  existingPhotoUrl,
  submitting,
  formError,
  fieldErrors,
  onSubmit,
  cancelHref,
}: {
  mode: "create" | "edit";
  initial?: Partial<VisitorFormValues>;
  existingPhotoUrl?: string;
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
  const [missingPhoto, setMissingPhoto] = useState(false);

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
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_auto]">
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
          <legend className="text-xs font-medium text-ink-700">Category</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-md border px-3.5 py-3 transition-colors ${
                  category === option.value
                    ? "border-accent bg-accent/5"
                    : "border-rule-strong hover:border-rule-strong"
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
                  <span className="text-sm font-medium text-ink-900">
                    {option.label}
                  </span>
                </span>
                <span className="mt-0.5 block pl-6 text-xs text-ink-500">
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
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-pressed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
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
            className="rounded-md px-3 py-2.5 text-sm text-ink-700 hover:text-ink-900"
          >
            Cancel
          </Link>
        </div>
      </div>

      <div className="w-full lg:w-auto">
        <PhotoUpload
          onChange={setPhoto}
          existingUrl={existingPhotoUrl}
          error={
            missingPhoto
              ? "A badge needs a photo. Add one before registering."
              : fieldError("photo")
          }
        />

        {mode === "edit" ? (
          <p className="mt-2 max-w-md text-xs text-ink-500">
            Editing details does not reissue the badge. The serial and the QR code
            stay exactly as printed.
          </p>
        ) : null}
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
      <label htmlFor={id} className="block text-xs font-medium text-ink-700">
        {label}
        {required ? null : <span className="ml-1 text-ink-500">(optional)</span>}
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
        className={`mt-1.5 w-full rounded-md border bg-card px-3 py-2.5 text-sm text-ink-900 focus:ring-2 focus:ring-accent/25 focus:outline-none ${
          error ? "border-revoked focus:border-revoked" : "border-rule-strong focus:border-accent"
        }`}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-revoked">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
