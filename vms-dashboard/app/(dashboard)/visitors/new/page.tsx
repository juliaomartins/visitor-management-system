"use client";

import Link from "next/link";
import { useState } from "react";

import { useSetPageMeta } from "@/components/page-meta";
import { BadgeTokenReceipt } from "@/components/visitors/BadgeTokenReceipt";
import { VisitorForm } from "@/components/visitors/VisitorForm";
import { useErrorText, useT } from "@/lib/i18n";
import { ApiError, useRegisterVisitor, type VisitorIssued } from "@/lib/visitors";

export default function NewVisitorPage() {
  const t = useT();
  const errorText = useErrorText();
  const register = useRegisterVisitor();
  const [issued, setIssued] = useState<VisitorIssued | null>(null);

  useSetPageMeta({
    title: t(issued ? "register.issuedTitle" : "register.title"),
    subtitle: t(issued ? "register.issuedSubtitle" : "register.subtitle"),
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
        ← {t("visitor.allVisitors")}
      </Link>

      <div className="mt-5">
        <VisitorForm
          mode="create"
          submitting={register.isPending}
          formError={
            error && Object.keys(error.fields).length === 0
              ? errorText(error, "error.visitorRegister")
              : undefined
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
