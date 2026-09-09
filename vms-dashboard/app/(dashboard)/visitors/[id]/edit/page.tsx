"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useSetPageMeta } from "@/components/page-meta";
import { useErrorText, useT } from "@/lib/i18n";
import { VisitorForm } from "@/components/visitors/VisitorForm";
import { ApiError, useUpdateVisitor, useVisitor } from "@/lib/visitors";

export default function EditVisitorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const errorText = useErrorText();
  const { data: visitor, isPending, isError } = useVisitor(id);
  const update = useUpdateVisitor(id);

  useSetPageMeta({
    title: visitor
      ? t("edit.title", { name: visitor.full_name })
      : t("edit.fallbackTitle"),
    subtitle: visitor?.badge_serial,
  });

  if (isPending) {
    return <p className="mono text-xs text-ink-3">{t("common.loading")}</p>;
  }

  if (isError || !visitor) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="display text-lg text-revoked">
          {t("visitor.notFound")}
        </p>
        <Link
          href="/visitors"
          className="mt-4 inline-block text-sm text-ink underline underline-offset-4"
        >
          {t("visitor.backToAll")}
        </Link>
      </div>
    );
  }

  const error = update.error instanceof ApiError ? update.error : undefined;

  return (
    <div>
      <Link
        href={`/visitors/${id}`}
        className="text-sm text-ink-3 transition-colors hover:text-ink"
      >
        ← {visitor.full_name}
      </Link>

      <div className="mt-5">
        <VisitorForm
          mode="edit"
          initial={{
            full_name: visitor.full_name,
            country: visitor.country,
            organization: visitor.organization ?? "",
            category: visitor.category ?? "normal",
          }}
          existingPhotoUrl={visitor.photo}
          badgeSerial={visitor.badge_serial}
          registeredAt={visitor.created_at}
          submitting={update.isPending}
          formError={
            error && Object.keys(error.fields).length === 0
              ? errorText(error, "error.visitorSave")
              : undefined
          }
          fieldErrors={error?.fields}
          cancelHref={`/visitors/${id}`}
          onSubmit={(values) =>
            update.mutate(values, {
              onSuccess: () => router.push(`/visitors/${id}`),
            })
          }
        />
      </div>
    </div>
  );
}
