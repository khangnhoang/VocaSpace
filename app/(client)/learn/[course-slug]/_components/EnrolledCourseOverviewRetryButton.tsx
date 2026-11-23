"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function EnrolledCourseOverviewRetryButton() {
  const t = useTranslations("learn");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700"
    >
      <RotateCcw aria-hidden="true" className="size-4" />
      {isPending ? t("overview.feedback.retrying") : t("overview.feedback.retry")}
    </Button>
  );
}
