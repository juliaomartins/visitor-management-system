"use client";

import Link from "next/link";
import { useState } from "react";

import { useSetPageMeta } from "@/components/page-meta";
import { BadgeTokenReceipt } from "@/components/visitors/BadgeTokenReceipt";
import { VisitorForm } from "@/components/visitors/VisitorForm";
import { ApiError, useRegisterVisitor, type VisitorIssued } from "@/lib/visitors";

export default function NewVisitorPage() {
  const register = useRegisterVisitor();
  const [issued, setIssued] = useState<VisitorIssued | null>(null);

  useSetPageMeta({
    title: issued ? "Badge issued" : "Register a visitor",
    subtitle: issued
      ? "Print the card now, or from the visitor's page later"
      : "One badge, printed in advance, valid for the whole event",
  });

  const error = register.error instanceof ApiError ? register.error : undefined;

  if (issued) {
    return (
      <BadgeTokenReceipt
        visitor={issued}
        onRegisterAnother={() => {
          setIssued(null);
          register.reset();
        }}
      />
    );
  }

  return (
    <div>
      <Link
        href="/visitors"
        className="text-sm text-ink-3 transition-colors hover:text-ink"
      >
        ← All visitors
      </Link>

      <div className="mt-5">
        <VisitorForm
          mode="create"
          submitting={register.isPending}
          formError={
            error && Object.keys(error.fields).length === 0 ? error.message : undefined
          }
          fieldErrors={error?.fields}
          cancelHref="/visitors"
          onSubmit={(values) =>
            register.mutate(values, { onSuccess: (visitor) => setIssued(visitor) })
          }
        />
      </div>
    </div>
  );
}
