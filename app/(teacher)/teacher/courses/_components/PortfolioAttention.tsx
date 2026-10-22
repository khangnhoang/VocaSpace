"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCheck, ClipboardCheck, MessageSquareText } from "lucide-react";
import { attentionIdentity, attentionPath, sortAttention } from "@/lib/course-authoring/portfolio";
import type { TeacherAttentionItem } from "@/lib/schemas/teacher-course-portfolio";
import { Button } from "@/components/ui/button";

export default function PortfolioAttention({ items }: { items: TeacherAttentionItem[] }) {
  const [filter, setFilter] = useState("all");
  const ordered = sortAttention(items);
  const visible = ordered.filter((item) => filter === "all" || (filter === "review" ? item.kind === "topic_review" : item.kind !== "topic_review"));
  const reviewCount = items.filter((item) => item.kind === "topic_review").length;
  const filterIndex = filter === 'all' ? 0 : filter === 'review' ? 1 : 2;

  return <section aria-labelledby="portfolio-attention-heading" className="min-w-0 overflow-hidden rounded-2xl border border-slate-300 bg-white">
    <div className="p-5 pb-0 sm:p-6 sm:pb-0">
      <div className="flex items-center justify-between gap-3"><h2 id="portfolio-attention-heading" className="text-lg font-bold text-slate-900">Cần bạn xử lý</h2><span className="text-sm font-semibold text-slate-600" aria-label={`${items.length} việc cần xử lý`}>{items.length} việc</span></div>
      <p className="mt-2 text-sm leading-6 text-slate-600">Phản hồi và bài học đang chờ bước tiếp theo của bạn.</p>
      <div role="group" aria-label="Lọc việc cần xử lý" className="relative mt-4 grid grid-cols-3 border-b border-slate-200">
        {([['all', 'Tất cả', items.length], ['review', 'Chờ duyệt', reviewCount], ['correction', 'Cần sửa', items.length - reviewCount]] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 min-w-0 border-b-2 border-transparent px-1 py-3 text-xs font-semibold outline-none transition-colors duration-220 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route motion-reduce:transition-none sm:text-sm ${filter === value ? 'text-route' : 'text-slate-600 hover:bg-slate-50'}`}>{label} <span className="ml-1 text-xs">{count}</span></button>)}
        <span aria-hidden="true" data-slot="portfolio-attention-indicator" className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/3 bg-route transition-transform duration-220 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none" style={{ transform: `translateX(${filterIndex * 100}%)` }} />
      </div>
    </div>
    {/* Đổi viewport để hủy quán tính cuộn của bộ lọc cũ và bắt đầu từ việc ưu tiên đầu tiên. */}
    <div key={filter} role="region" aria-label="Kết quả việc cần xử lý" tabIndex={0} className={`${items.length ? 'h-100' : 'h-52'} overflow-y-auto overscroll-y-contain [overflow-anchor:none] px-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route sm:px-6`}>
      {visible.length ? <ul className="divide-y divide-slate-200">{visible.map((item) => <li key={attentionIdentity(item)} className="py-5">
        <p className={`flex items-center gap-2 text-xs font-semibold ${item.kind === 'topic_review' ? 'text-attention' : 'text-correction'}`}>{item.kind === 'topic_review' ? <ClipboardCheck size={16} aria-hidden="true" /> : <MessageSquareText size={16} aria-hidden="true" />}{item.kind === 'topic_review' ? 'Bài học chờ duyệt' : item.kind === 'course_rejection' ? 'Khóa học cần sửa' : 'Bài học cần sửa'}</p>
        <h3 className="mt-2 font-semibold leading-6 text-slate-900 [overflow-wrap:anywhere]">{item.topic_title ?? item.course_title}</h3>
        {item.topic_id ? <p className="mt-1 text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">{item.course_title}</p> : null}
        {item.reason ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{item.reason}</p> : null}
        <Button asChild variant="link" className="mt-2 px-0 coarse-input:h-11 coarse-input:bg-action coarse-input:px-5 coarse-input:text-action-foreground coarse-input:hover:no-underline"><Link href={attentionPath(item)} aria-label={`${item.kind === 'topic_review' ? 'Duyệt' : 'Sửa'}: ${item.topic_title ?? item.course_title}`}>{item.kind === 'topic_review' ? 'Duyệt bài học' : 'Xem và chỉnh sửa'}<ArrowUpRight className="size-4.5 coarse-input:size-5" aria-hidden="true" /></Link></Button>
      </li>)}</ul> : <div className="flex h-full flex-col items-center justify-center py-8 text-center"><CheckCheck className="mb-3 text-growth" size={28} aria-hidden="true" /><p className="font-semibold text-slate-900">{items.length ? 'Không có việc trong bộ lọc này' : 'Chưa có việc cần xử lý'}</p><p className="mt-2 max-w-65 text-sm leading-6 text-slate-600">{items.length ? 'Chọn bộ lọc khác để xem các việc còn lại.' : 'Khi có bài học chờ duyệt hoặc phản hồi cần sửa, chúng sẽ xuất hiện ở đây.'}</p></div>}
    </div>
  </section>;
}
