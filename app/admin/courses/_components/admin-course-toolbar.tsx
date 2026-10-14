"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildAdminCoursesHref } from "@/lib/admin/routes";
import {
  adminCourseStatusFilters,
  type AdminCourseFilter,
  type AdminCourseStatusFilter,
  type AdminCourseTabCounts,
} from "@/lib/schemas/admin-course";

export const tabLabels: Record<AdminCourseStatusFilter, string> = {
  pending: "Chờ duyệt",
  published: "Đã xuất bản",
  draft: "Bản nháp",
  all: "Tất cả",
  removed: "Đã gỡ",
};

export const sortCaptions: Record<AdminCourseStatusFilter, string> = {
  pending: "Sắp xếp theo thời gian gửi duyệt, khóa học chờ lâu nhất ở đầu.",
  removed: "Sắp xếp theo thời gian gỡ, khóa học vừa gỡ ở đầu.",
  published: "Sắp xếp theo lần cập nhật gần nhất.",
  draft: "Sắp xếp theo lần cập nhật gần nhất.",
  all: "Sắp xếp theo lần cập nhật gần nhất.",
};

type AdminCourseToolbarProps = {
  filter: AdminCourseFilter;
  counts: AdminCourseTabCounts | null;
};

// Tab và tìm kiếm đều là URL (AD3 AC3): tab là liên kết thật, tìm kiếm là form GET nên hoạt động cả khi chưa hydrate.
// Khi đã hydrate, gõ vào ô tìm kiếm cập nhật `q` trong URL sau SEARCH_DEBOUNCE_MS (router.replace, không thêm lịch sử); Enter áp ngay.
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MAX_LENGTH = 100;

export function AdminCourseToolbar({ filter, counts }: AdminCourseToolbarProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(filter.q);
  // `own` là các cụm tìm kiếm trang này đã gửi lên URL mà URL chưa phản ánh hết. Khi `filter.q` đổi thành một cụm trong danh sách này
  // thì đó là hệ quả của chính người dùng đang gõ (không ghi đè ô nhập, kể cả khi URL về muộn hoặc bị bỏ qua một bước);
  // đổi thành giá trị khác (Xóa tìm kiếm, Back/Forward, liên kết tab) thì ô nhập đồng bộ theo URL.
  const [sync, setSync] = useState<{ seenQ: string; own: string[] }>({ seenQ: filter.q, own: [] });
  const timerRef = useRef<number | null>(null);
  const latestRef = useRef<{ draft: string; apply: (value: string) => void } | null>(null);

  if (filter.q !== sync.seenQ) {
    const ownIndex = sync.own.indexOf(filter.q);
    if (ownIndex >= 0) {
      setSync({ seenQ: filter.q, own: sync.own.slice(ownIndex + 1) });
    } else {
      setSync({ seenQ: filter.q, own: [] });
      setDraft(filter.q);
    }
  }

  // Cụm đã yêu cầu gần nhất (kể cả khi URL chưa kịp đổi): so với nó để không điều hướng lặp và để URL cuối luôn là cụm gõ sau cùng.
  const requestedTerm = sync.own.length > 0 ? sync.own[sync.own.length - 1] : filter.q;

  const apply = (value: string) => {
    // Cụm mới luôn quay về trang 1 (buildAdminCoursesHref bỏ `page`) và giữ tab hiện tại; rỗng thì bỏ `q`.
    const term = value.trim().slice(0, SEARCH_MAX_LENGTH);
    if (term === requestedTerm) return;
    setSync((current) => ({ ...current, own: [...current.own, term] }));
    router.replace(buildAdminCoursesHref({ status: filter.status, q: term }));
  };

  // Timer luôn gọi bản apply và ô nhập mới nhất, nên không điều hướng theo closure cũ.
  useEffect(() => {
    latestRef.current = { draft, apply };
  });

  const cancelTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Hủy timer đang chờ khi rời trang hoặc khi tab đổi để timer cũ không điều hướng về sau.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [filter.status]);

  const handleChange = (value: string) => {
    setDraft(value);
    cancelTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const latest = latestRef.current;
      if (latest) latest.apply(latest.draft);
    }, SEARCH_DEBOUNCE_MS);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    cancelTimer();
    apply(draft);
  };

  // Chuyển tab: bỏ cụm đang chờ gõ dở và đưa ô nhập về đúng URL.
  const handleTabClick = () => {
    cancelTimer();
    setSync((current) => ({ ...current, own: [] }));
    setDraft(filter.q);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#111827] p-4 shadow-sm">
      <form
        role="search"
        method="get"
        action="/admin/courses"
        onSubmit={submit}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        {filter.status !== "pending" ? <input type="hidden" name="status" value={filter.status} /> : null}
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            value={draft}
            maxLength={SEARCH_MAX_LENGTH}
            onChange={(event) => handleChange(event.target.value)}
            aria-label="Tìm khóa học theo tên hoặc slug"
            placeholder="Tìm theo tên hoặc slug..."
            className="h-10 border-slate-500 bg-[#0B1120] pl-10 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:border-route focus-visible:ring-route/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="default" className="h-10">
            Tìm kiếm
          </Button>
          {filter.q ? (
            <Button
              asChild
              variant="outline"
              className="h-10 border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white"
            >
              <Link href={buildAdminCoursesHref({ status: filter.status })}>Xóa tìm kiếm</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <nav aria-label="Lọc khóa học theo trạng thái">
        <ul className="flex flex-wrap gap-1.5">
          {adminCourseStatusFilters.map((tab) => {
            const isCurrent = tab === filter.status;
            return (
              <li key={tab}>
                <Link
                  href={buildAdminCoursesHref({ status: tab, q: filter.q })}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={handleTabClick}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827] ${
                    isCurrent
                      ? "border-slate-500 bg-[#1E293B] text-white"
                      : "border-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {tabLabels[tab]}
                  {counts ? (
                    <span
                      className={`min-w-6 rounded-md px-1.5 py-0.5 text-center text-xs font-bold tabular-nums ${
                        isCurrent ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      {counts[tab]}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
