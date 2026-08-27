"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useSetPageMeta } from "@/components/page-meta";
import { VisitorForm } from "@/components/visitors/VisitorForm";
import { ApiError, useUpdateVisitor, useVisitor } from "@/lib/visitors";

export default function EditVisitorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: visitor, isPending, isError } = useVisitor(id);
  const update = useUpdateVisitor(id);

  useSetPageMeta({
    title: visitor ? `Edit ${visitor.full_name}` : "Edit visitor",
    subtitle: visitor?.badge_serial,
  });

  if (isPending) {
    return <p className="mono text-xs text-ink-3">Loading…</p>;
  }

  if (isError || !visitor) {
    return (
      <div className="rounded-lg border border-line bg-card px-6 py-16 text-center">
        <p className="display text-lg font-semibold text-revoked">
          Could not load this visitor
        </p>
        <Link
          href="/visitors"
          className="mt-4 inline-block text-sm text-ink underline underline-offset-4"
        >
          Back to all visitors
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
          submitting={update.isPending}
          formError={
            error && Object.keys(error.fields).length === 0 ? error.message : undefined
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
