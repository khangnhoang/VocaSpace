"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RetryLabels } from "@/lib/i18n/courses-text";

// Nhãn bắt buộc do người gọi (Server Component) truyền theo ngôn ngữ đang dùng, để nút không phải kéo catalog `courses` về trình
// duyệt và `/` không cần namespace đó (U2 G4, H2).
export function PublicCourseRetryButton({
  className = "mt-6 min-h-10 px-4",
  labels,
}: {
  className?: string;
  labels: RetryLabels;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function retry() {
    // refresh giữ việc đọc dữ liệu ở Server Component thay vì kéo cả view sang client.
    startTransition(() => router.refresh());
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={retry}
      disabled={isPending}
    >
      {isPending ? labels.pending : labels.retry}
    </Button>
  );
}
