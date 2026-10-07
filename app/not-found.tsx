import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import Header from "@/components/ui/header";
import { Button } from "@/components/ui/button";

// Trang này nằm ở root nên không nằm trong (client)/layout.tsx; vì vậy tự render Header đúng một lần (F1 G4).
// Title dùng `absolute` để không bị ghép vào template của khu vực học tập (`%s | Vocaspace Learn`).
// Đây là nguồn title duy nhất: các route khóa học/learner gọi notFound() ngay trong generateMetadata khi `not_found`,
// nên Next dùng metadata này thay cho title của route. Next tự chèn `noindex` cho mọi phản hồi not-found.
const NOT_FOUND_TITLE = "Không tìm thấy trang | VocaSpace";

export const metadata: Metadata = {
  title: { absolute: NOT_FOUND_TITLE },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <section
        aria-labelledby="not-found-heading"
        className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Compass className="size-7" aria-hidden="true" />
        </span>
        <h1 id="not-found-heading" className="mt-6 text-2xl font-bold text-slate-900 sm:text-3xl">
          Không tìm thấy trang
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Đường dẫn bạn mở không tồn tại hoặc nội dung này không còn khả dụng. Bạn có thể quay về trang chủ hoặc xem
          các khóa học đang mở.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg">
            <Link href="/">Về trang chủ</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/courses">Xem khóa học</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
