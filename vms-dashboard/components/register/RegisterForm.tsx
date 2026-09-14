"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { matchCountry } from "@/lib/countries";
import type { FaceCheck } from "@/lib/face-check";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";
import {
  PUBLIC_STATUS_KEY,
  RegistrationError,
  savePass,
  submitPublicRegistration,
} from "@/lib/registration";

import { CountryField } from "./CountryField";
import { PhotoStep } from "./PhotoStep";

const FAILURE_MESSAGE: Record<string, MessageKey> = {
  throttled: "publicRegister.tooMany",
  too_large: "publicRegister.tooLarge",
  network: "publicRegister.unreachable",
  server: "publicRegister.failed",
  invalid: "publicRegister.failed",
};

/**
 * Four fields and a photo.
 *
 * Register stays disabled until the face check has passed -- or could not run
 * on this phone at all, in which case the photo is not blocked. The check is
 * guidance; the kiosk desk sees every photo on the list.
 */
export function RegisterForm() {
  const t = useT();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [organization, setOrganization] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [face, setFace] = useState<FaceCheck | "checking" | null>(null);

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [countryInvalid, setCountryInvalid] = useState(false);

  const faceOk =
    face !== null &&
    face !== "checking" &&
    (face.outcome === "one" || face.outcome === "unavailable");
  const ready = Boolean(fullName.trim() && country.trim() && photo && faceOk);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!photo || !faceOk) return;

    const canonical = matchCountry(country);
    if (!canonical) {
      setCountryInvalid(true);
      return;
    }

    setBusy(true);
    setFailure(null);
    setFields({});

    try {
      const result = await submitPublicRegistration({
        full_name: fullName.trim(),
        country: canonical,
        organization: organization.trim(),
        photo,
      });
      savePass({ ...result, photo: await asDataUrl(photo) });
    } catch (cause) {
      if (cause instanceof RegistrationError) {
        if (cause.kind === "closed") {
          // The switch was turned off while this form was open: show the
          // closed state rather than an error.
          void queryClient.invalidateQueries({ queryKey: PUBLIC_STATUS_KEY });
          return;
        }
        setFields(cause.fields);
        setFailure(FAILURE_MESSAGE[cause.kind] ?? "publicRegister.failed");
      } else {
        setFailure("publicRegister.failed");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="display text-2xl text-ink">{t("publicRegister.title")}</h1>
        <p className="mt-1.5 text-sm text-ink-2">{t("publicRegister.intro")}</p>
      </div>

      <TextField
        id="full_name"
        label={t("publicRegister.fullName")}
        value={fullName}
        onChange={setFullName}
        autoComplete="name"
        required
        errors={fields.full_name}
      />

      <CountryField
        value={country}
        onChange={(value) => {
          setCountry(value);
          setCountryInvalid(false);
        }}
        invalid={countryInvalid}
        errors={fields.country}
      />

      <TextField
        id="organization"
        label={t("publicRegister.organization")}
        value={organization}
        onChange={setOrganization}
        autoComplete="organization"
        errors={fields.organization}
      />

      <PhotoStep
        onPhoto={(file) => {
          setPhoto(file);
          setFace(file ? "checking" : null);
        }}
        onFaceCheck={setFace}
        face={face}
        errors={fields.photo}
      />

      <p className="text-xs leading-relaxed text-ink-3">{t("publicRegister.consent")}</p>

      {failure ? (
        <p
          role="alert"
          className="rounded-lg bg-revoked-soft px-3.5 py-2.5 text-sm text-revoked"
        >
          {t(failure)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!ready || busy}
        className="btn btn-primary w-full py-3 text-base disabled:opacity-50"
      >
        {busy ? t("publicRegister.submitting") : t("publicRegister.submit")}
      </button>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required,
  errors,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  errors?: string[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        maxLength={200}
        aria-invalid={errors ? true : undefined}
        className="field mt-1.5 text-base"
      />
      {errors ? (
        <p role="alert" className="mt-1.5 text-xs text-revoked">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function asDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
