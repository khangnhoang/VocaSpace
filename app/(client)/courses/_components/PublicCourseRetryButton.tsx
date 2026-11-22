"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { retryLabels, viCoursesText, type RetryLabels } from "@/lib/i18n/courses-text";

// Nhãn do người gọi truyền theo ngôn ngữ đang dùng; mặc định là tiếng Việt để nút vẫn gọi được như hàm thuần (test) và không
// cần provider.
export function PublicCourseRetryButton({
  className = "mt-6 min-h-10 px-4",
  labels = retryLabels(viCoursesText),
}: {
  className?: string;
  labels?: RetryLabels;
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
