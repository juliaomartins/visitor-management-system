"use client";

import { useState } from "react";

import { CountryCombobox } from "@/components/country-combobox";
import { PhotoStep } from "@/components/register/PhotoStep";
import { COUNTRY_NAMES } from "@/lib/countries";
import { DeskError, registerWalkIn, type DeskRegistration, type VisitorCategory } from "@/lib/desk";
import type { FaceCheck } from "@/lib/face-check";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales";

const FAILURE_MESSAGE: Record<string, MessageKey> = {
  unpaired: "desk.unpaired",
  wrong_device: "desk.wrongDevice",
  too_large: "desk.tooLarge",
  throttled: "desk.tooMany",
  network: "desk.unreachable",
  server: "desk.failed",
  invalid: "desk.failed",
};

const CATEGORIES: { value: VisitorCategory; labelKey: MessageKey }[] = [
  { value: "normal", labelKey: "desk.normal" },
  { value: "vip", labelKey: "desk.vip" },
];

/**
 * One visitor, as fast as the photo allows.
 *
 * The same country list and the same photo step as the public form: one list
 * keeps the entrance report from splitting a delegation three ways, and one
 * photo path means a walk-in badge meets the same 225px print floor as every
 * other badge. The desk adds the one thing the public form has no business
 * offering -- VIP.
 *
 * Unlike the public form, the face check is guidance only and never blocks: a
 * staff member is standing there looking at the visitor, which is a better check
 * than a model running on a laptop, and a queue is not the place to argue with
 * it.
 */
export function DeskForm({
  onRegistered,
}: {
  onRegistered: (registration: DeskRegistration) => void;
}) {
  const t = useT();

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [organization, setOrganization] = useState("");
  const [category, setCategory] = useState<VisitorCategory>("normal");
  const [photo, setPhoto] = useState<File | null>(null);
  const [face, setFace] = useState<FaceCheck | "checking" | null>(null);

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [countryChecked, setCountryChecked] = useState(false);

  const countryInvalid = countryChecked && !COUNTRY_NAMES.has(country);
  const ready = Boolean(fullName.trim() && country && photo && !busy);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!photo) return;

    if (!COUNTRY_NAMES.has(country)) {
      setCountryChecked(true);
      return;
    }

    setBusy(true);
    setFailure(null);
    setFields({});

    try {
      onRegistered(
        await registerWalkIn({
          full_name: fullName.trim(),
          country,
          organization: organization.trim(),
          category,
          photo,
        }),
      );
    } catch (cause) {
      if (cause instanceof DeskError) {
        setFields(cause.fields);
        setFailure(FAILURE_MESSAGE[cause.kind] ?? "desk.failed");
      } else {
        setFailure("desk.failed");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <h1 className="display text-2xl text-ink">{t("desk.formTitle")}</h1>

      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-ink-2">
          {t("desk.fullName")}
        </label>
        <input
          id="full_name"
          name="full_name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="off"
          autoFocus
          required
          maxLength={200}
          aria-invalid={fields.full_name ? true : undefined}
          className="field mt-1.5 text-base"
        />
        {fields.full_name ? (
          <p role="alert" className="mt-1.5 text-xs text-revoked">
            {fields.full_name.join(" ")}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="country" className="block text-sm font-medium text-ink-2">
          {t("desk.country")}
        </label>
        <CountryCombobox
          id="country"
          name="country"
          value={country}
          onValueChange={setCountry}
          onFocus={() => setCountryChecked(false)}
          onBlur={() => setCountryChecked(true)}
          required
          aria-invalid={countryInvalid || fields.country ? true : undefined}
          aria-describedby={countryInvalid || fields.country ? "country-error" : undefined}
          className="field mt-1.5 text-base"
        />
        {countryInvalid || fields.country ? (
          <p id="country-error" role="alert" className="mt-1.5 text-xs text-revoked">
            {countryInvalid ? t("country.invalid") : fields.country?.join(" ")}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="organization" className="block text-sm font-medium text-ink-2">
          {t("desk.organization")}
        </label>
        <input
          id="organization"
          name="organization"
          value={organization}
          onChange={(event) => setOrganization(event.target.value)}
          autoComplete="off"
          maxLength={200}
          aria-invalid={fields.organization ? true : undefined}
          className="field mt-1.5 text-base"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink-2">{t("desk.category")}</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {CATEGORIES.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-base font-medium transition-colors ${
                category === option.value
                  ? "bg-graphite-950 text-white"
                  : "bg-card-2 text-ink hover:bg-line"
              }`}
            >
              <input
                type="radio"
                name="category"
                value={option.value}
                checked={category === option.value}
                onChange={() => setCategory(option.value)}
                className="sr-only"
              />
              {t(option.labelKey)}
            </label>
          ))}
        </div>
      </fieldset>

      <PhotoStep
        label={t("desk.photo")}
        hint={t("desk.photoHint")}
        onPhoto={setPhoto}
        onFaceCheck={setFace}
        face={face}
        errors={fields.photo}
      />

      {failure ? (
        <p role="alert" className="rounded-lg bg-revoked-soft px-3.5 py-2.5 text-sm text-revoked">
          {t(failure)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!ready}
        className="btn btn-primary btn-lg w-full disabled:opacity-50"
      >
        {busy ? t("desk.registering") : t("desk.register")}
      </button>
    </form>
  );
}
